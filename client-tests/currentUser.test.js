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
      // Mirror deployed framework: default off so the server does not fabricate
      // a resolved entry for arbitrary emails (e.g. dummy@dummy.com). Pass
      // { allowEmailAddresses: true } to inspect the old fabrication behavior.
      AllowEmailAddresses:     options.allowEmailAddresses ?? false,
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
  // NOTE: _spPost sends the whole 2nd arg as the body. The picker endpoint
  // expects { queryParams: {...} } at the top level -- do NOT wrap in { data }.
  const data = await _spPost(endpoint, _buildSearchPayload(query, options));
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

/**
 * MIRRORS the deployed framework `_resolvePickerIdentity` in people.api.ts.
 * Queries the picker by samAccountName (raw, all provider variants) and
 * disambiguates multi-account users: exact Key -> provider-prefix -> first.
 * This is how the NEW getFullUserDetails derives email/displayName.
 */
async function _pickerIdentity(normalizedLogin) {
  try {
    const sam = parseEmployeeId(normalizedLogin);
    const { parsed } = await _rawSearch(sam, { maximumSuggestions: 20 }); // parsed = raw, unnormalized
    const resolved = parsed.filter(r => r.IsResolved === true);
    if (!resolved.length) return null;

    let hit;
    if (resolved.length === 1) {
      hit = resolved[0];
    } else {
      hit = resolved.find(r => r.Key === normalizedLogin);            // priority 1: exact Key
      if (!hit) {
        const pm = normalizedLogin.match(/^(i:[^|]+\|)/);
        if (pm) hit = resolved.find(r => r.Key.startsWith(pm[1]));    // priority 2: provider prefix
      }
      if (!hit) hit = resolved[0];                                    // priority 3: first
    }
    return { email: hit.EntityData?.Email || null, displayName: hit.DisplayText || null };
  } catch (err) {
    console.warn('[_pickerIdentity] picker resolution failed, caller falls back', { normalizedLogin, err });
    return null;
  }
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

    // Step 4: picker identity (NEW -- deployed framework prefers this for email/displayName)
    const picker = await _pickerIdentity(normalizedLogin);
    console.group('%c4. clientPeoplePickerSearchUser (picker identity -- NEW)', 'color:#4ea1ff');
    console.log(picker);
    console.groupEnd();

    // Consolidated -- mirrors the CURRENT getFullUserDetails return (picker-first).
    const details = {
      employeeId:   parseEmployeeId(spUser.LoginName),
      loginName:    spUser.LoginName,
      displayName:  picker?.displayName || profile?.DisplayName || spUser.Title,
      email:        picker?.email || profile?.Email || spUser.Email,
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

    console.group('%c=> consolidated FullUserDetails (picker-first, matches deployed)', 'color:#39d353;font-weight:bold');
    console.log(details);
    console.log('claims breakdown:', decodeClaims(details.loginName));
    console.table([
      { field: 'claimsLogin', value: details.loginName,   source: 'ensureUser.LoginName' },
      { field: 'employeeId',  value: details.employeeId,  source: 'parseEmployeeId(LoginName)' },
      { field: 'siteUserId',  value: details.siteUserId,  source: 'ensureUser.Id' },
      { field: 'displayName', value: details.displayName, source: picker?.displayName ? 'picker.DisplayText' : profile?.DisplayName ? 'profile.DisplayName (fallback)' : 'ensureUser.Title (fallback)' },
      { field: 'email',       value: details.email,       source: picker?.email ? 'picker.EntityData.Email' : profile?.Email ? 'profile.Email (fallback)' : 'ensureUser.Email (fallback)' },
    ]);
    // All three email sources side by side -- see exactly where they diverge.
    console.table([
      { field: 'email',       picker: picker?.email ?? '(none)',       upsProfile: profile?.Email ?? '(none)',       ensureUser: spUser.Email, final: details.email },
      { field: 'displayName', picker: picker?.displayName ?? '(none)', upsProfile: profile?.DisplayName ?? '(none)', ensureUser: spUser.Title, final: details.displayName },
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
      PrincipalType: r.EntityData?.PrincipalType,
      // AD-backed users carry a Windows claim (i:0#.w|); fabricated email entries
      // (AllowEmailAddresses) carry a forms/membership claim (i:0#.f|) or the raw email.
      adBacked: /^i:0#\.w\|/.test(String(r.Key)),
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
      let status = 'source-only';
      if (overlap) {
        const a = String(search), b = String(fullDetails);
        // Case-SENSITIVE first -- casing drift is a real query-miss cause.
        if (a === b) status = 'MATCH';
        else if (a.toLowerCase() === b.toLowerCase()) status = 'CASE-DIFF';
        else status = 'DIFF';
      }
      return { field, searchUsers: search, getFullUserDetails: fullDetails, status };
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
// Public: the core email-format discrepancy check
// ---------------------------------------------------------------------------

/**
 * For ONE user, compares the email produced by the CurrentUser /
 * getFullUserDetails path (FORMAT A -- what a user records about themselves)
 * against the email produced by searchUsers (FORMAT B -- what someone looking
 * that user up receives). Byte-level, case-SENSITIVE. This is the exact drift
 * that makes a list query written in one format miss rows keyed in the other.
 *
 * @param {string} [loginNameOrEmail] - User to inspect. Defaults to the session user.
 */
export async function compareEmail(loginNameOrEmail) {
  const input = loginNameOrEmail ?? _sessionEmail() ?? _sessionLogin();
  console.group(`%c[compareEmail] ${input}`, 'font-weight:bold');
  try {
    // FORMAT A -- exactly what the DEPLOYED CurrentUser.get('email') /
    // getFullUserDetails.email yields: picker EntityData.Email first, then UPS,
    // then ensureUser (must match src/base/sharepoint/api/people.api.ts).
    const login  = await _resolveLoginName(input);
    const [spUser, profile, picker] = await Promise.all([
      _ensureUser(login),
      _fetchProfile(login).catch(err => { console.warn('[compareEmail] profile fetch failed', { login, err }); return null; }),
      _pickerIdentity(login),
    ]);
    const emailA  = picker?.email || profile?.Email || spUser.Email;
    const sourceA = picker?.email ? 'picker EntityData.Email (samAccountName query)'
                  : profile?.Email ? 'UPS profile.Email (fallback)'
                  : 'ensureUser.Email (fallback)';

    // FORMAT B -- what searchUsers exposes. Show every provider variant.
    const { raw, normalized } = await debugSearchUsers(input);
    const emailB    = normalized[0]?.EntityData?.Email ?? '';
    const variantsB = [...new Set(raw.filter(r => r.IsResolved).map(r => r.EntityData?.Email).filter(Boolean))];

    const exactEqual   = emailA === emailB;
    const ciEqual      = emailA.toLowerCase() === emailB.toLowerCase();
    const caseOnly     = !exactEqual && ciEqual;

    console.table([
      { format: 'A  CurrentUser/getFullUserDetails.email', email: emailA, len: emailA.length, from: sourceA },
      { format: 'B  searchUsers EntityData.Email',         email: emailB, len: emailB.length, from: 'people-picker EntityData.Email' },
    ]);
    if (variantsB.length > 1) {
      console.warn('searchUsers returns MULTIPLE email variants (provider-dependent):', variantsB);
    }
    if (!emailB && parseEmployeeId(login)) {
      console.warn('FORMAT B email is EMPTY -- picker resolved by claims only. Keying on email will fail; use employeeId instead:', parseEmployeeId(login));
    }

    if (exactEqual) {
      console.log('%cEXACT MATCH -- identical strings, no drift', 'color:#39d353;font-weight:bold');
    } else if (caseOnly) {
      console.warn('DIFFERS BY CASE ONLY. CAML Text `Eq` is case-INsensitive (would still match), but client-side JS === and some OData compares are case-sensitive (would miss).');
    } else {
      console.error('%cDIFFERENT STRINGS -- a query in one format will NEVER match rows stored in the other', 'color:#ff5555;font-weight:bold');
    }

    return {
      user: login,
      employeeId: parseEmployeeId(login),
      emailA, emailB, variantsB,
      exactEqual, caseInsensitiveEqual: ciEqual, differsByCaseOnly: caseOnly,
    };
  } catch (err) {
    console.error('[compareEmail] failed', err);
    throw err;
  } finally {
    console.groupEnd();
  }
}

// ---------------------------------------------------------------------------
// Public: root-cause diagnostic for a DIFFERENT-STRINGS email mismatch
// ---------------------------------------------------------------------------

/**
 * Runs BOTH picker queries that FORMAT A and FORMAT B use and shows which AD
 * principal each resolves to. Pinpoints why the emails differ:
 *   - FORMAT A (CurrentUser record): picker query by samAccountName, pick exact-Key
 *   - FORMAT B (app lookup):         picker query by email, pick normalized-richest
 * If the two queries land on different `Key`s, the user has multiple AD accounts
 * and the sam-query vs email-query resolve to different principals.
 *
 * @param {string} [loginNameOrEmail] - Defaults to the session user.
 */
export async function diagnoseEmailMismatch(loginNameOrEmail) {
  const input = loginNameOrEmail ?? _sessionEmail() ?? _sessionLogin();
  console.group(`%c[diagnoseEmailMismatch] ${input}`, 'font-weight:bold');
  try {
    const login = await _resolveLoginName(input);
    const sam = parseEmployeeId(login);

    const [spUser, profile] = await Promise.all([
      _ensureUser(login),
      _fetchProfile(login).catch(err => { console.warn('[diagnose] profile fetch failed', { login, err }); return null; }),
    ]);
    const inputIsEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(input));
    const emailSeed = inputIsEmail ? String(input) : (spUser.Email || profile?.Email || '');

    console.log('resolved login:', login);
    console.log('FORMAT A query key (samAccountName):', sam);
    console.log('FORMAT B query key (email):', emailSeed, inputIsEmail ? '(from your input)' : '(from ensureUser/UPS)');

    const cols = (arr) => arr.map(r => ({ Key: r.Key, email: r.EntityData?.Email, name: r.DisplayText, provider: r.ProviderName, type: r.EntityType }));

    // FORMAT A: query by samAccountName
    const { parsed: rawA } = await _rawSearch(sam, { maximumSuggestions: 20 });
    const resolvedA = rawA.filter(r => r.IsResolved);
    console.group(`%cFORMAT A -- picker by samAccountName "${sam}" (${resolvedA.length} resolved)`, 'color:#4ea1ff');
    console.table(cols(resolvedA));
    console.groupEnd();
    const pickA = (await _pickerIdentity(login))?.email ?? '';

    // FORMAT B: query by email
    let resolvedB = [], pickB = '';
    if (emailSeed) {
      const { parsed: rawB } = await _rawSearch(emailSeed, { maximumSuggestions: 20 });
      resolvedB = rawB.filter(r => r.IsResolved);
      console.group(`%cFORMAT B -- picker by email "${emailSeed}" (${resolvedB.length} resolved)`, 'color:#4ea1ff');
      console.table(cols(resolvedB));
      console.groupEnd();
      pickB = _normalizeResults(rawB)[0]?.EntityData?.Email ?? '';
    } else {
      console.warn('[diagnose] no email seed -- cannot run FORMAT B query');
    }

    const keysB = new Set(resolvedB.map(r => r.Key));
    const sharePrincipal = resolvedA.some(r => keysB.has(r.Key));

    console.group('%c=> DIAGNOSIS', 'color:#39d353;font-weight:bold');
    console.table([
      { path: 'A record  (sam query, exact-Key)',     pickedEmail: pickA },
      { path: 'B lookup  (email query, normalized)',   pickedEmail: pickB },
    ]);
    console.log('same email string?', pickA === pickB);
    console.log('queries share a principal (Key)?', sharePrincipal);
    if (!sharePrincipal && resolvedB.length) {
      console.error('ROOT CAUSE: sam-query and email-query resolve to DIFFERENT AD principals (multi-account). FIX: record the email the SAME email-keyed way the lookup does, so both converge on the same principal.');
    } else if (pickA !== pickB) {
      console.error('ROOT CAUSE: same principal set, different variant selected (exact-Key vs normalized-richest), or casing. FIX: identical selection + lowercase on both sides.');
    } else {
      console.log('picks agree -- no mismatch on this user.');
    }
    console.groupEnd();

    return { login, sam, emailSeed, pickA, pickB, sharePrincipal, resolvedA, resolvedB };
  } catch (err) {
    console.error('[diagnoseEmailMismatch] failed', err);
    throw err;
  } finally {
    console.groupEnd();
  }
}

// ---------------------------------------------------------------------------
// Public: group-resolution / access-level diagnostic
// ---------------------------------------------------------------------------

/**
 * Explains why `CurrentUser.accessLevel` / `.group` may be null while
 * `get('groups')` is correct. Group resolution checks membership via an
 * `Email eq` filter on the UIL Email column. This tests EACH candidate email
 * (session, picker, UPS, UIL) against each hierarchy group so you can see which
 * email SharePoint's membership filter actually matches -- and whether the email
 * CurrentUser uses (session || picker) matches anything.
 *
 * @param {string|string[]} groupTitles - The `groupTitle` values from your hierarchy.
 */
export async function debugGroupResolution(groupTitles) {
  const titles = [].concat(groupTitles ?? []).filter(Boolean);
  if (!titles.length) {
    console.warn('[debugGroupResolution] pass your hierarchy group titles, e.g. debugGroupResolution(["Site Owners","Members"])');
    return;
  }
  console.group('%c[debugGroupResolution]', 'font-weight:bold');
  try {
    const login = await _resolveLoginName(_sessionLogin());
    const [spUser, profile, picker] = await Promise.all([
      _ensureUser(login),
      _fetchProfile(login).catch(err => { console.warn('[debugGroupResolution] profile fetch failed', { login, err }); return null; }),
      _pickerIdentity(login),
    ]);

    const candidates = {
      sessionEmail: _sessionEmail() || '',        // _spPageContextInfo.userEmail
      pickerEmail:  picker?.email || '',           // == deployed CurrentUser.get('email')
      upsEmail:     profile?.Email || '',
      uilEmail:     spUser.Email || '',
    };
    // Exactly what CurrentUser.initialize uses for group resolution today:
    const groupEmailUsed = candidates.sessionEmail || candidates.pickerEmail;

    console.log('candidate emails:', candidates);
    console.log('%cemail CurrentUser uses for groups (session || picker):', 'font-weight:bold', groupEmailUsed || '(EMPTY)');

    const isMember = async (title, email) => {
      if (!email) return '(empty)';
      const selector = `getbyname('${encodeURIComponent(title.replace(/'/g, "''"))}')`;
      const filter = encodeURIComponent(`Email eq '${email.replace(/'/g, "''")}'`);
      const url = `${_webUrl()}/_api/web/sitegroups/${selector}/users?$filter=${filter}&$select=Id,LoginName,Title,Email`;
      try {
        return _unwrapCollection(_unwrapD(await _spGet(url))).length > 0;
      } catch (err) {
        console.warn('[debugGroupResolution] membership query failed', { title, email, err });
        return 'ERR';
      }
    };

    const rows = [];
    for (const title of titles) {
      const row = { group: title };
      for (const [k, email] of Object.entries(candidates)) row[k] = await isMember(title, email);
      rows.push(row);
    }
    console.table(rows);

    const matchedWithUsed = [];
    for (const title of titles) if ((await isMember(title, groupEmailUsed)) === true) matchedWithUsed.push(title);

    console.group('%c=> VERDICT', 'color:#39d353;font-weight:bold');
    console.log('groups matched with the email CurrentUser uses:', matchedWithUsed);
    if (!matchedWithUsed.length) {
      console.error('accessLevel would be NULL. The email CurrentUser uses matches NO group. Look at the table: whichever column shows `true` is the email group resolution SHOULD use (likely uilEmail/upsEmail, not pickerEmail).');
    } else {
      console.log('accessLevel would resolve here. If the live app still sees null, the deployed bundle differs from this test.');
    }
    console.groupEnd();

    return { candidates, groupEmailUsed, rows, matchedWithUsed };
  } catch (err) {
    console.error('[debugGroupResolution] failed', err);
    throw err;
  } finally {
    console.groupEnd();
  }
}

// ---------------------------------------------------------------------------
// Public: identity canonicalization diagnostic
// ---------------------------------------------------------------------------

/**
 * Deterministically picks ONE canonical entry from a cluster of picker results
 * for the same person. Ordering (stable, caller-independent):
 *   1. entries WITH an email beat entries without
 *   2. richer entry (higher _scoreResult) wins
 *   3. tiebreak: lexicographically smallest Key
 * Same cluster in -> same pick out, regardless of which email was searched.
 */
function _pickCanonical(cluster) {
  if (!cluster.length) return null;
  return [...cluster].sort((a, b) => {
    const ae = a.EntityData?.Email ? 1 : 0;
    const be = b.EntityData?.Email ? 1 : 0;
    if (ae !== be) return be - ae;
    const as = _scoreResult(a);
    const bs = _scoreResult(b);
    if (as !== bs) return bs - as;
    return String(a.Key).localeCompare(String(b.Key));
  })[0];
}

/** Enumerate the full account cluster reachable from a seed query via samAccountName. */
async function _clusterFor(seedQuery) {
  const { parsed: seed } = await _rawSearch(seedQuery, { maximumSuggestions: 30 });
  const seedResolved = seed.filter(r => r.IsResolved);
  const sams = [...new Set(seedResolved.map(r => parseEmployeeId(r.Key).toLowerCase()).filter(Boolean))];
  const byKey = new Map();
  for (const sam of sams) {
    const { parsed } = await _rawSearch(sam, { maximumSuggestions: 50 });
    for (const r of parsed.filter(x => x.IsResolved)) byKey.set(r.Key, r);
  }
  return { sams, cluster: [...byKey.values()] };
}

/**
 * The canonicalization test. For a person, enumerates ALL their accounts (joined
 * by samAccountName), picks a deterministic canonical entry, then verifies that
 * searching by EVERY email in the cluster re-converges to the SAME canonical
 * entity. This is the "resolve to the same entity always" guarantee check.
 *
 * @param {string} [input] - Any email or login of the person. Defaults to session user.
 */
export async function canonicalEntity(input) {
  const seed = input ?? _sessionEmail() ?? _sessionLogin();
  console.group(`%c[canonicalEntity] ${seed}`, 'font-weight:bold');
  try {
    const { sams, cluster } = await _clusterFor(seed);
    console.log('samAccountName join key(s):', sams);
    console.group(`%caccount cluster (${cluster.length})`, 'color:#4ea1ff');
    console.table(cluster.map(r => ({
      Key: r.Key,
      sam: parseEmployeeId(r.Key),
      email: r.EntityData?.Email ?? '',
      name: r.DisplayText,
      provider: r.ProviderName,
      type: r.EntityType,
      score: _scoreResult(r),
    })));
    console.groupEnd();

    if (sams.length > 1) {
      console.warn('MORE THAN ONE samAccountName in cluster -- accounts do NOT share a single join key. Deterministic merge by sam is not possible for these; a manual alias->canonical map would be required.', sams);
    }

    const canonical = _pickCanonical(cluster);
    console.log('%cCANONICAL pick:', 'color:#39d353;font-weight:bold',
      canonical ? { Key: canonical.Key, email: canonical.EntityData?.Email, name: canonical.DisplayText } : null);

    // Convergence: does starting from each email land on the same canonical Key?
    const emails = [...new Set(cluster.map(r => r.EntityData?.Email).filter(Boolean))];
    const conv = [];
    for (const e of emails) {
      const { cluster: c2 } = await _clusterFor(e);
      const pick = _pickCanonical(c2);
      conv.push({
        searchedEmail: e,
        resolvesToKey: pick?.Key ?? '(none)',
        resolvesToEmail: pick?.EntityData?.Email ?? '(none)',
        sameAsCanonical: pick?.Key === canonical?.Key,
      });
    }
    console.group('%c=> CONVERGENCE (search each email -> canonical)', 'color:#39d353;font-weight:bold');
    console.table(conv);
    const allConverge = conv.length > 0 && conv.every(c => c.sameAsCanonical);
    if (allConverge) {
      console.log('%cCONVERGES -- every email resolves to the same entity. samAccountName join works.', 'color:#39d353;font-weight:bold');
    } else {
      console.error('DIVERGES -- some emails resolve to a different entity. Inspect the table: the sam join key is insufficient for this person.');
    }
    console.groupEnd();

    return { seed, sams, cluster, canonical, convergence: conv, allConverge };
  } catch (err) {
    console.error('[canonicalEntity] failed', err);
    throw err;
  } finally {
    console.groupEnd();
  }
}

// ---------------------------------------------------------------------------
// Console exposure
// ---------------------------------------------------------------------------

window.canonicalEntity      = canonicalEntity;
window.debugGroupResolution = debugGroupResolution;
window.diagnoseEmailMismatch = diagnoseEmailMismatch;
window.debugCurrentUser     = debugCurrentUser;
window.debugSearchUsers     = debugSearchUsers;
window.compareUserSources   = compareUserSources;
window.compareEmail         = compareEmail;
window.dumpProfileProperties = dumpProfileProperties;
window.parseEmployeeId      = parseEmployeeId;
window.decodeClaims         = decodeClaims;
window.DebugUserError       = DebugUserError;

console.log('[currentUser debug] loaded.');
console.log('  await canonicalEntity(loginOrEmail?)     -- enumerate one account cluster + prove every email resolves to ONE entity');
console.log('  await diagnoseEmailMismatch(loginOrEmail?) -- WHY A and B differ: both picker queries + which principal each hits');
console.log('  await compareEmail(loginOrEmail?)        -- FORMAT A (CurrentUser) vs FORMAT B (searchUsers), byte-level');
console.log('  await debugCurrentUser(loginOrEmail?)   -- full getFullUserDetails pipeline, raw + consolidated');
console.log('  await debugSearchUsers(query, options?)  -- picker search, raw + normalized');
console.log('  await compareUserSources(loginOrEmail?)  -- searchUsers vs getFullUserDetails, field by field');
console.log('  await dumpProfileProperties(loginOrEmail?) -- every non-empty UPS profile property');
