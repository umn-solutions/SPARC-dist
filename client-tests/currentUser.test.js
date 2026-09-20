/**
 * CurrentUser / searchUsers debug harness.
 *
 * Reproduces the exact endpoint pipeline of `src/base/sharepoint/api/people.api.ts`
 * and `src/base/sharepoint/user/CurrentUser.ts` with vanilla fetch, dumping the
 * RAW SharePoint response of every step alongside the framework-normalized
 * output. Lets you see precisely what each source returns and where the two
 * sources agree or diverge for a given user.
 *
 * Self-contained: vanilla fetch + native Error. No framework dependencies, so it
 * works even on pages that do not load the SPARC bundle.
 *
 * The four endpoints mirrored here (same as getFullUserDetails):
 *   1. ensureUser (POST)                       -> SPUser { Id, LoginName, Title, Email }
 *   2. getuserbyid(id)/groups (GET)            -> SPGroup[]
 *   3. PeopleManager/GetPropertiesFor (GET)    -> UserProfilePayload
 *   4. clientPeoplePickerSearchUser (POST)     -> PeopleSearchResult[]  (searchUsers)
 *
 * Console usage:
 *   await import('/<your-site>/client-tests/currentUser.test.js');
 *
 *   await debugCurrentUser();                 // full getFullUserDetails pipeline for the session user
 *   await debugCurrentUser('DOMAIN\\jdoe');   // ...for any login or email
 *   await debugSearchUsers('john');           // raw + normalized people-picker search
 *   await compareUserSources();               // session user: searchUsers vs getFullUserDetails, field by field
 *   await compareUserSources('jdoe@corp');    // ...for a specific user
 *   await dumpProfileProperties();            // every non-empty UPS profile property for the session user
 */

// ---------------------------------------------------------------------------
// Env
// ---------------------------------------------------------------------------

const _ctx = () => window._spPageContextInfo ?? {};

const _webUrl = () =>
  (_ctx().webAbsoluteUrl ?? location.origin).replace(/\/$/, '');

const _sessionLogin = () => _ctx().userLoginName ?? '';
const _sessionEmail = () => _ctx().userEmail ?? '';

const _getDigest = () => {
  const el = document.getElementById('__REQUESTDIGEST');
  if (el && el.value) return el.value;
  if (_ctx().formDigestValue) return _ctx().formDigestValue;
  throw new DebugUserError('DigestUnavailable',
    'No request digest found. Page must include the SharePoint form digest.');
};

const _getHeaders = () => ({ 'Accept': 'application/json;odata=verbose' });

const _postHeaders = () => ({
  'Accept':          'application/json;odata=verbose',
  'Content-Type':    'application/json;odata=verbose',
  'X-RequestDigest': _getDigest(),
});

// ---------------------------------------------------------------------------
// DebugUserError
// ---------------------------------------------------------------------------

class DebugUserError extends Error {
  constructor(name, message, details = null, cause = null) {
    super(message);
    this.name    = name;
    this.details = details;
    if (cause) this.cause = cause;
  }
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

function _extractOdataMessage(text) {
  if (!text) return '(empty body)';
  try {
    const json = JSON.parse(text);
    const e = json['odata.error'] ?? json.error;
    if (!e) return text;
    return e.message?.value ?? e.message ?? text;
  } catch (err) {
    console.warn('[debug] could not parse OData error body, returning raw text', { text, err });
    return text;
  }
}

async function _spGet(url) {
  const res  = await fetch(url, { method: 'GET', headers: _getHeaders(), credentials: 'include' });
  const text = await res.text();
  if (!res.ok) {
    throw new DebugUserError('HttpError',
      `GET ${url} -> HTTP ${res.status}: ${_extractOdataMessage(text)}`,
      { status: res.status, body: text });
  }
  return text ? JSON.parse(text) : null;
}

async function _spPost(url, payload) {
  const res  = await fetch(url, {
    method:      'POST',
    headers:     _postHeaders(),
    body:        JSON.stringify(payload),
    credentials: 'include',
  });
  const text = await res.text();
  if (!res.ok) {
    throw new DebugUserError('HttpError',
      `POST ${url} -> HTTP ${res.status}: ${_extractOdataMessage(text)}`,
      { status: res.status, body: text, correlation: res.headers.get('sprequestguid') });
  }
  return text ? JSON.parse(text) : null;
}

// ---------------------------------------------------------------------------
// Unwrap helpers (mirror people.api.ts _unwrapD / _unwrapCollection)
// ---------------------------------------------------------------------------

function _unwrapD(data) {
  if (data !== null && typeof data === 'object') {
    if ('d' in data) return data.d;
    if ('value' in data && !Array.isArray(data.value)) return data.value;
  }
  return data;
}

function _unwrapCollection(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === 'object') {
    if (Array.isArray(data.results)) return data.results;
    if (Array.isArray(data.value))   return data.value;
  }
  return [];
}

// ---------------------------------------------------------------------------
// Field helpers (mirror people.api.ts)
// ---------------------------------------------------------------------------

function parseEmployeeId(loginName) {
  const raw = String(loginName ?? '');
  const afterPipe = raw.includes('|') ? raw.split('|').pop() : raw;
  return afterPipe.includes('\\') ? afterPipe.split('\\').pop() : afterPipe;
}

/**
 * Decomposes a claims-encoded login (`i:0#.w|DOMAIN\user`) into its parts so
 * you can see the claim provider prefix, domain, and samAccountName separately.
 */
function decodeClaims(loginName) {
  const raw = String(loginName ?? '');
  const claimsPrefix = (raw.match(/^(i:[^|]+\|)/) || [])[1] ?? '';
  const afterPipe = raw.includes('|') ? raw.split('|').pop() : raw;
  const domain = afterPipe.includes('\\') ? afterPipe.split('\\')[0] : '';
  const samAccountName = afterPipe.includes('\\') ? afterPipe.split('\\').pop() : afterPipe;
  return { raw, claimsPrefix, domain, samAccountName, isClaims: raw.startsWith('i:') };
}

function _buildSearchPayload(query, options = {}) {
  return {
    queryParams: {
      __metadata:              { type: 'SP.UI.ApplicationPages.ClientPeoplePickerQueryParameters' },
      QueryString:             query,
      MaximumEntitySuggestions: options.maximumSuggestions ?? 10,
      PrincipalType:           options.principalType ?? 1,
      PrincipalSource:         options.principalSource ?? 15,
      AllowEmailAddresses:     true,
      AllowMultipleEntities:   true,
      SharePointGroupID:       0,
    },
  };
}

function _scoreResult(r) {
  let s = 0;
  if (r.DisplayText)            s++;
  if (r.EntityData?.Email)      s++;
  if (r.EntityData?.Title)      s++;
  if (r.EntityData?.Department) s++;
  if (r.EntityData?.MobilePhone) s++;
  if (r.EntityData?.SIPAddress) s++;
  if (r.EntityData?.PrincipalType) s++;
  return s;
}

function _normalizeResults(results) {
  const flat = [];
  for (const r of results) {
    flat.push(r);
    if (Array.isArray(r.MultipleMatches) && r.MultipleMatches.length) flat.push(...r.MultipleMatches);
  }
  const resolved = flat.filter(r => r.IsResolved === true);
  const map = new Map();
  for (const r of resolved) {
    const rawKey = r.EntityData?.Email || parseEmployeeId(r.Key);
    const key = String(rawKey).toLowerCase();
    if (!key) { console.warn('[debugSearchUsers] dropping result with no email or login key', r); continue; }
    const existing = map.get(key);
    if (!existing || _scoreResult(r) > _scoreResult(existing)) map.set(key, r);
  }
  return [...map.values()];
}

// ---------------------------------------------------------------------------
// Endpoint calls (each returns RAW, unwrapping is explicit at the call site)
// ---------------------------------------------------------------------------

async function _rawSearch(query, options = {}) {
  const endpoint = `${_webUrl()}/_api/SP.UI.ApplicationPages`
    + `.ClientPeoplePickerWebServiceInterface.clientPeoplePickerSearchUser`;
  const data = await _spPost(endpoint, { data: _buildSearchPayload(query, options) });
  const unwrapped = _unwrapD(data);
  const rawJson = typeof unwrapped === 'string' ? unwrapped : unwrapped.ClientPeoplePickerSearchUser;
  return { envelope: data, parsed: JSON.parse(rawJson) };
}

async function _resolveLoginName(login) {
  if (String(login).startsWith('i:')) return login;
  const { parsed } = await _rawSearch(login, { maximumSuggestions: 10 });
  const resolved = parsed.filter(r => r.IsResolved);
  if (resolved.length === 0) return login;
  if (resolved.length === 1) return resolved[0].Key;
  const currentLogin = _sessionLogin();
  const prefixMatch = currentLogin.match(/^(i:[^|]+\|)/);
  if (prefixMatch) {
    const same = resolved.find(r => r.Key.startsWith(prefixMatch[1]) && r.IsResolved);
    if (same) return same.Key;
  }
  return resolved[0].Key;
}

async function _ensureUser(loginName) {
  const data = await _spPost(`${_webUrl()}/_api/web/ensureuser`, { logonName: loginName });
  return _unwrapD(data);
}

async function _fetchUserGroups(userId) {
  const data = await _spGet(`${_webUrl()}/_api/web/getuserbyid(${userId})/groups`);
  return _unwrapCollection(_unwrapD(data));
}

async function _fetchProfile(loginName) {
  const encoded = encodeURIComponent(`'${loginName}'`);
  const endpoint = `${_webUrl()}/_api/SP.UserProfiles.PeopleManager`
    + `/GetPropertiesFor(accountName=@v)?@v=${encoded}`;
  return _unwrapD(await _spGet(endpoint));
}

function _profilePropsToObject(profile) {
  return Object.fromEntries(
    _unwrapCollection(profile?.UserProfileProperties)
      .filter(p => p.Value)
      .map(p => [p.Key, p.Value]),
  );
}

// ---------------------------------------------------------------------------
// Public: full getFullUserDetails pipeline, every step dumped
// ---------------------------------------------------------------------------

/**
 * Runs the exact getFullUserDetails pipeline (ensureUser -> groups -> profile)
 * and logs the RAW response of each step plus the final consolidated object.
 *
 * @param {string} [loginNameOrEmail] - Login/email to inspect. Defaults to the session user.
 * @returns {Promise<object>} The consolidated FullUserDetails-shaped object.
 */
export async function debugCurrentUser(loginNameOrEmail) {
  const input = loginNameOrEmail ?? _sessionLogin();
  console.group(`%c[debugCurrentUser] ${input}`, 'font-weight:bold');
  try {
    console.log('session context:', {
      userLoginName: _sessionLogin(),
      userEmail:     _sessionEmail(),
      webAbsoluteUrl: _webUrl(),
    });

    const normalizedLogin = await _resolveLoginName(input);
    console.log('resolved claims login:', normalizedLogin,
      normalizedLogin === input ? '(unchanged)' : '(resolved via picker)');

    // Step 1: ensureUser (required)
    const spUser = await _ensureUser(normalizedLogin);
    console.group('%c1. ensureUser (raw SPUser)', 'color:#4ea1ff');
    console.log(spUser);
    console.groupEnd();

    // Step 2: groups (fault-tolerant)
    let groups = [];
    try {
      groups = await _fetchUserGroups(spUser.Id);
    } catch (err) {
      console.warn('[debugCurrentUser] groups fetch failed, continuing empty', { userId: spUser.Id, err });
    }
    console.group(`%c2. getuserbyid(${spUser.Id})/groups (raw SPGroup[], ${groups.length})`, 'color:#4ea1ff');
    console.table(groups.map(g => ({ Id: g.Id, Title: g.Title, OwnerTitle: g.OwnerTitle })));
    console.log(groups);
    console.groupEnd();

    // Step 3: profile (fault-tolerant)
    let profile = null;
    try {
      profile = await _fetchProfile(normalizedLogin);
    } catch (err) {
      console.warn('[debugCurrentUser] profile fetch failed, continuing without it', { loginName: normalizedLogin, err });
    }
    console.group('%c3. PeopleManager/GetPropertiesFor (raw UserProfilePayload)', 'color:#4ea1ff');
    console.log(profile);
    console.groupEnd();

    // Consolidated (mirror getFullUserDetails return)
    const details = {
      employeeId:   parseEmployeeId(spUser.LoginName),
      loginName:    spUser.LoginName,
      displayName:  profile?.DisplayName ?? spUser.Title,
      email:        profile?.Email || spUser.Email,
      siteUserId:   spUser.Id,
      jobTitle:     profile?.Title ?? '',
      pictureUrl:   profile?.PictureUrl ?? '',
      personalUrl:  profile?.PersonalUrl ?? '',
      directReports: _unwrapCollection(profile?.DirectReports),
      managers:     _unwrapCollection(profile?.ExtendedManagers),
      peers:        _unwrapCollection(profile?.Peers),
      groups,
      profileProperties: _profilePropsToObject(profile),
    };

    console.group('%c=> consolidated FullUserDetails', 'color:#39d353;font-weight:bold');
    console.log(details);
    console.log('claims breakdown:', decodeClaims(details.loginName));
    // Primary identity fields WITH provenance -- which underlying source won.
    // displayName/email are the fields that can silently diverge: the profile
    // (UPS) value is preferred, ensureUser is only the fallback.
    console.table([
      { field: 'claimsLogin', value: details.loginName,   source: 'ensureUser.LoginName' },
      { field: 'employeeId',  value: details.employeeId,  source: 'parseEmployeeId(LoginName)' },
      { field: 'siteUserId',  value: details.siteUserId,  source: 'ensureUser.Id' },
      { field: 'displayName', value: details.displayName, source: profile?.DisplayName ? 'profile.DisplayName' : 'ensureUser.Title (fallback)' },
      { field: 'email',       value: details.email,       source: profile?.Email ? 'profile.Email' : 'ensureUser.Email (fallback)' },
    ]);
    // Raw side-by-side for the two fields that can disagree between sources.
    console.table([
      { field: 'displayName', ensureUser: spUser.Title, upsProfile: profile?.DisplayName ?? '(no profile)', final: details.displayName },
      { field: 'email',       ensureUser: spUser.Email, upsProfile: profile?.Email ?? '(no profile)',       final: details.email },
    ]);
    console.groupEnd();

    return details;
  } catch (err) {
    console.error('[debugCurrentUser] pipeline failed', err);
    throw err;
  } finally {
    console.groupEnd();
  }
}

// ---------------------------------------------------------------------------
// Public: people-picker search, raw + normalized
// ---------------------------------------------------------------------------

/**
 * Runs clientPeoplePickerSearchUser and logs both the raw parsed results and
 * the framework-normalized set (phantom drop, MultipleMatches flatten, dedup).
 *
 * @param {string} query - Search string (name, email, or login).
 * @param {object} [options] - { maximumSuggestions, principalType, principalSource }.
 * @returns {Promise<{ raw: object[], normalized: object[] }>}
 */
export async function debugSearchUsers(query, options = {}) {
  if (!query) throw new DebugUserError('Validation', 'debugSearchUsers: query is required.');
  console.group(`%c[debugSearchUsers] "${query}"`, 'font-weight:bold');
  try {
    const { parsed } = await _rawSearch(query, options);
    const normalized = _normalizeResults(parsed);

    console.group(`%craw PeopleSearchResult[] (${parsed.length})`, 'color:#4ea1ff');
    console.table(parsed.map(r => ({
      Key: r.Key,
      employeeId: parseEmployeeId(r.Key),
      DisplayText: r.DisplayText,
      Email: r.EntityData?.Email,
      IsResolved: r.IsResolved,
      EntityType: r.EntityType,
      Provider: r.ProviderName,
      MultipleMatches: r.MultipleMatches?.length ?? 0,
    })));
    console.log(parsed);
    console.groupEnd();

    console.group(`%cnormalized (${normalized.length})`, 'color:#39d353');
    console.table(normalized.map(r => ({
      claimsLogin: r.Key,
      employeeId: parseEmployeeId(r.Key),
      displayName: r.DisplayText,
      email: r.EntityData?.Email ?? '',
      entityType: r.EntityType,
    })));
    console.log(normalized);
    console.groupEnd();

    return { raw: parsed, normalized };
  } catch (err) {
    console.error('[debugSearchUsers] failed', err);
    throw err;
  } finally {
    console.groupEnd();
  }
}

// ---------------------------------------------------------------------------
// Public: side-by-side comparison of the two sources for one user
// ---------------------------------------------------------------------------

/**
 * Resolves one user through BOTH sources and prints a field-by-field diff,
 * answering "do searchUsers and getFullUserDetails return the same data?".
 *
 * @param {string} [loginNameOrEmail] - Defaults to the session user's email/login.
 * @returns {Promise<{ search: object|null, details: object, comparison: object[] }>}
 */
export async function compareUserSources(loginNameOrEmail) {
  const input = loginNameOrEmail ?? _sessionEmail() ?? _sessionLogin();
  console.group(`%c[compareUserSources] ${input}`, 'font-weight:bold');
  try {
    // Source A: single best picker hit
    const { normalized } = await debugSearchUsers(input);
    const hit = normalized[0] ?? null;
    if (!hit) console.warn('[compareUserSources] searchUsers returned no resolved match for', input);

    // Source B: full profile pipeline
    const details = await debugCurrentUser(input);

    const searchView = hit ? {
      loginName:   hit.Key,
      employeeId:  parseEmployeeId(hit.Key),
      displayName: hit.DisplayText,
      email:       hit.EntityData?.Email ?? '',
    } : {};

    // Primary identity fields only.
    const rows = [
      ['claimsLogin', searchView.loginName,   details.loginName],
      ['employeeId',  searchView.employeeId,  details.employeeId],
      ['displayName', searchView.displayName, details.displayName],
      ['email',       searchView.email,       details.email],
      ['siteUserId',  '(not in searchUsers)', details.siteUserId],
    ];

    const comparison = rows.map(([field, search, fullDetails]) => {
      const overlap = !String(search).startsWith('(not in') && !String(fullDetails).startsWith('(not in');
      const match = overlap
        ? (String(search).toLowerCase() === String(fullDetails).toLowerCase() ? 'MATCH' : 'DIFF')
        : 'source-only';
      return { field, searchUsers: search, getFullUserDetails: fullDetails, status: match };
    });

    console.group('%c=> field-by-field comparison', 'color:#39d353;font-weight:bold');
    console.table(comparison);
    const diffs = comparison.filter(c => c.status === 'DIFF');
    if (diffs.length) console.warn(`${diffs.length} overlapping field(s) DIFFER between sources`, diffs);
    else console.log('all overlapping fields MATCH');
    console.groupEnd();

    return { search: hit, details, comparison };
  } catch (err) {
    console.error('[compareUserSources] failed', err);
    throw err;
  } finally {
    console.groupEnd();
  }
}

// ---------------------------------------------------------------------------
// Public: dump every non-empty UPS profile property
// ---------------------------------------------------------------------------

/**
 * Fetches the PeopleManager profile for a user and prints EVERY non-empty
 * profile property (UserProfileProperties) as a sorted table. Useful for
 * discovering which AD/UPS keys are populated on this farm.
 *
 * @param {string} [loginNameOrEmail] - Defaults to the session user.
 * @returns {Promise<Record<string,string>>}
 */
export async function dumpProfileProperties(loginNameOrEmail) {
  const input = loginNameOrEmail ?? _sessionLogin();
  console.group(`%c[dumpProfileProperties] ${input}`, 'font-weight:bold');
  try {
    const login = await _resolveLoginName(input);
    const profile = await _fetchProfile(login);
    const props = _profilePropsToObject(profile);
    const rows = Object.entries(props)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([Key, Value]) => ({ Key, Value }));
    console.table(rows);
    console.log(`${rows.length} non-empty profile properties`, props);
    return props;
  } catch (err) {
    console.error('[dumpProfileProperties] failed', err);
    throw err;
  } finally {
    console.groupEnd();
  }
}

// ---------------------------------------------------------------------------
// Console exposure
// ---------------------------------------------------------------------------

window.debugCurrentUser     = debugCurrentUser;
window.debugSearchUsers     = debugSearchUsers;
window.compareUserSources   = compareUserSources;
window.dumpProfileProperties = dumpProfileProperties;
window.parseEmployeeId      = parseEmployeeId;
window.decodeClaims         = decodeClaims;
window.DebugUserError       = DebugUserError;

console.log('[currentUser debug] loaded.');
console.log('  await debugCurrentUser(loginOrEmail?)   -- full getFullUserDetails pipeline, raw + consolidated');
console.log('  await debugSearchUsers(query, options?)  -- picker search, raw + normalized');
console.log('  await compareUserSources(loginOrEmail?)  -- searchUsers vs getFullUserDetails, field by field');
console.log('  await dumpProfileProperties(loginOrEmail?) -- every non-empty UPS profile property');
