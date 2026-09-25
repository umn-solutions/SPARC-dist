/**
 * Account Finder -- discovery harness for multi-account / duplicate-UIL users.
 *
 * Given an email, samAccountName, display name, or claims login, this sweeps
 * EVERY SharePoint identity source and shows ALL candidate account entries for
 * that person so you can eyeball which are:
 *   - DUPLICATES / aliases (residual AD updates, proxy addresses)  -> collapse to a canonical
 *   - DISTINCT accounts    (e.g. EMEA vs AMER regional accounts)   -> keep separate
 *
 * Sources swept:
 *   1. People Picker  (clientPeoplePickerSearchUser)  -- AD/UPS directory
 *   2. Site UIL       (/_api/web/siteUsers)           -- surfaces ghost/incomplete rows the picker hides
 *   3. UPS profile    (PeopleManager/GetPropertiesFor) -- aliases (proxyAddresses), department, office, DN/OU (region)
 *
 * It CLUSTERS by samAccountName and sub-groups by domain, then FLAGS:
 *   - same sam + same domain, multiple Keys -> likely duplicates (suggests a canonical)
 *   - same sam + different domain           -> likely distinct/regional (KEEP SEPARATE)
 * The tool never auto-merges. You decide.
 *
 * Self-contained: vanilla fetch + native Error. No framework/bundle dependency.
 *
 * Console usage:
 *   await import('/<your-site>/client-tests/accountFinder.test.js');
 *
 *   await findAccounts('jane.doe@corp');        // by email
 *   await findAccounts('jdoe');                 // by samAccountName
 *   await findAccounts('Jane Doe');             // by display name
 *   await findAccounts('i:0#.w|CORP\\jdoe');    // by claims login
 *   await findAccounts('jdoe', { enrich:false });  // skip UPS enrichment (faster, no aliases/region)
 *   await findAccounts('jdoe', { uil:false });     // skip UIL sweep (picker + UPS only)
 */

// ---------------------------------------------------------------------------
// Env
// ---------------------------------------------------------------------------

const _ctx = () => window._spPageContextInfo ?? {};
const _webUrl = () => (_ctx().webAbsoluteUrl ?? location.origin).replace(/\/$/, '');
const _sessionLogin = () => _ctx().userLoginName ?? '';

const _getDigest = () => {
  const el = document.getElementById('__REQUESTDIGEST');
  if (el && el.value) return el.value;
  if (_ctx().formDigestValue) return _ctx().formDigestValue;
  throw new AccountFinderError('DigestUnavailable',
    'No request digest found. Page must include the SharePoint form digest.');
};

// ---------------------------------------------------------------------------
// Error + HTTP
// ---------------------------------------------------------------------------

class AccountFinderError extends Error {
  constructor(name, message, details = null) {
    super(message);
    this.name = name;
    this.details = details;
  }
}

const _EMAIL_RX = /[^\s@;,<>]+@[^\s@;,<>]+\.[^\s@;,<>]+/g;
const _escOData = (s) => String(s).replace(/'/g, "''");
const _looksLikeEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s).trim());
const _looksLikeClaims = (s) => String(s).startsWith('i:');

// ---------------------------------------------------------------------------
// Request throttle -- global gap so EVERY picker/UIL/UPS call is paced.
// Serializes requests (a mutex) and enforces a minimum gap between them.
// ---------------------------------------------------------------------------

let _reqGapMs = 0;         // 0 = no throttle. Set via setRequestThrottle() or per-run opts.
let _reqMax429Retries = 4; // retries on HTTP 429/503 with backoff
let _pacer = Promise.resolve();

const _sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Set the minimum gap (ms) between ALL requests. 0 disables throttling. */
export function setRequestThrottle(ms) {
  _reqGapMs = Math.max(0, Number(ms) || 0);
  console.log(`[accountFinder] request throttle = ${_reqGapMs}ms between requests`);
  return _reqGapMs;
}

/** Mutex + gap: each request waits for the previous slot, then enforces the gap. */
async function _throttleGate() {
  if (_reqGapMs <= 0) return;
  const prev = _pacer;
  let release;
  _pacer = new Promise((r) => (release = r));
  try {
    await prev;
    await _sleep(_reqGapMs);
  } finally {
    release();
  }
}

/** Backoff wait honoring a Retry-After header (seconds or http-date-ish) if present. */
function _retryAfterMs(res, attempt) {
  const ra = res.headers.get('Retry-After');
  const secs = ra ? Number(ra) : NaN;
  if (Number.isFinite(secs) && secs > 0) return Math.min(secs * 1000, 30000);
  return Math.min(1000 * 2 ** attempt, 30000); // exponential backoff, capped 30s
}

async function _fetchThrottled(url, init, label) {
  for (let attempt = 0; ; attempt++) {
    await _throttleGate();
    const res = await fetch(url, init);
    if ((res.status === 429 || res.status === 503) && attempt < _reqMax429Retries) {
      const wait = _retryAfterMs(res, attempt);
      console.warn(`[accountFinder] HTTP ${res.status} (throttled) -- backing off ${wait}ms (retry ${attempt + 1}/${_reqMax429Retries})`, { url });
      await _sleep(wait);
      continue;
    }
    const text = await res.text();
    if (!res.ok) {
      throw new AccountFinderError('HttpError', `${label} ${url} -> HTTP ${res.status}`, { status: res.status, body: text });
    }
    return text ? JSON.parse(text) : null;
  }
}

async function _spGet(url) {
  return _fetchThrottled(url, {
    method: 'GET',
    headers: { Accept: 'application/json;odata=verbose' },
    credentials: 'include',
  }, 'GET');
}

async function _spPost(url, payload) {
  return _fetchThrottled(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json;odata=verbose',
      'Content-Type': 'application/json;odata=verbose',
      'X-RequestDigest': _getDigest(),
    },
    body: JSON.stringify(payload),
    credentials: 'include',
  }, 'POST');
}

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
    if (Array.isArray(data.value)) return data.value;
    if (data.d) return _unwrapCollection(data.d);
  }
  return [];
}

// ---------------------------------------------------------------------------
// Identity helpers
// ---------------------------------------------------------------------------

function decodeClaims(loginName) {
  const raw = String(loginName ?? '');
  const claimsPrefix = (raw.match(/^(i:[^|]+\|)/) || [])[1] ?? '';
  const afterPipe = raw.includes('|') ? raw.split('|').pop() : raw;
  const domain = afterPipe.includes('\\') ? afterPipe.split('\\')[0] : '';
  const sam = afterPipe.includes('\\') ? afterPipe.split('\\').pop() : afterPipe;
  return { raw, claimsPrefix, domain, sam, isClaims: raw.startsWith('i:') };
}

const _sam = (login) => decodeClaims(login).sam.toLowerCase();
const _adBacked = (key) => /^i:0#\.w\|/.test(String(key));

// ---------------------------------------------------------------------------
// Source 1: People Picker
// ---------------------------------------------------------------------------

async function _pickerSearch(query, max = 50) {
  const endpoint = `${_webUrl()}/_api/SP.UI.ApplicationPages`
    + `.ClientPeoplePickerWebServiceInterface.clientPeoplePickerSearchUser`;
  const payload = {
    queryParams: {
      // eslint-disable-next-line
      __metadata: { type: 'SP.UI.ApplicationPages.ClientPeoplePickerQueryParameters' },
      QueryString: query,
      MaximumEntitySuggestions: max,
      PrincipalType: 1,        // User
      PrincipalSource: 15,     // all providers
      AllowEmailAddresses: false, // do not fabricate resolved entries for arbitrary emails
      AllowMultipleEntities: true,
      SharePointGroupID: 0,
    },
  };
  try {
    const data = await _spPost(endpoint, payload);
    const unwrapped = _unwrapD(data);
    const rawJson = typeof unwrapped === 'string' ? unwrapped : unwrapped.ClientPeoplePickerSearchUser;
    const parsed = JSON.parse(rawJson);
    // flatten MultipleMatches
    const flat = [];
    for (const r of parsed) {
      flat.push(r);
      if (Array.isArray(r.MultipleMatches) && r.MultipleMatches.length) flat.push(...r.MultipleMatches);
    }
    return flat.filter(r => r.IsResolved === true);
  } catch (err) {
    console.warn('[accountFinder] picker search failed', { query, err });
    return [];
  }
}

// ---------------------------------------------------------------------------
// Source 2: Site UIL (siteUsers) -- finds ghost/incomplete rows the picker hides
// ---------------------------------------------------------------------------

async function _uilByFilter(filter) {
  const url = `${_webUrl()}/_api/web/siteUsers`
    + `?$filter=${encodeURIComponent(filter)}`
    + `&$select=Id,LoginName,Title,Email,PrincipalType&$top=200`;
  try {
    return _unwrapCollection(_unwrapD(await _spGet(url)));
  } catch (err) {
    console.warn('[accountFinder] UIL query failed', { filter, err });
    return [];
  }
}

// ---------------------------------------------------------------------------
// Source 3: UPS profile -- aliases (proxyAddresses), department, office, DN (region)
// ---------------------------------------------------------------------------

async function _ups(login) {
  const encoded = encodeURIComponent(`'${login}'`);
  const endpoint = `${_webUrl()}/_api/SP.UserProfiles.PeopleManager`
    + `/GetPropertiesFor(accountName=@v)?@v=${encoded}`;
  try {
    return _unwrapD(await _spGet(endpoint));
  } catch (err) {
    console.warn('[accountFinder] UPS fetch failed', { login, err });
    return null;
  }
}

function _profileProps(profile) {
  return Object.fromEntries(
    _unwrapCollection(profile?.UserProfileProperties)
      .filter(p => p && p.Key)
      .map(p => [p.Key, p.Value]),
  );
}

/** All distinct emails discoverable in a profile (WorkEmail + proxyAddresses + any email-shaped value). */
function _aliasesFromProfile(profile, props) {
  const found = new Set();
  const add = (v) => {
    const matches = String(v ?? '').match(_EMAIL_RX);
    if (matches) matches.forEach(m => found.add(m.toLowerCase()));
  };
  add(profile?.Email);
  for (const v of Object.values(props)) add(v);
  return [...found];
}

/** Region-relevant fields so you can tell EMEA vs AMER etc. */
function _regionHints(props) {
  const pick = (rx) => {
    const k = Object.keys(props).find(key => rx.test(key) && props[key]);
    return k ? props[k] : '';
  };
  const dn = pick(/distinguished/i);
  const ouRegion = (dn.match(/OU=([^,]+)/gi) || []).map(s => s.slice(3)).join(' / ');
  return {
    department: pick(/department/i),
    office: pick(/office|location/i),
    country: pick(/country/i),
    ou: ouRegion,
    distinguishedName: dn,
  };
}

// ---------------------------------------------------------------------------
// Deterministic canonical pick (within a group of near-identical entries)
// ---------------------------------------------------------------------------

function _score(e) {
  let s = 0;
  if (e.email) s++;
  if (e.displayName) s++;
  if (e.department) s++;
  if (e.office) s++;
  if (e.aliases?.length) s += e.aliases.length;
  if (e.siteUserId) s++;
  if (e.adBacked) s += 2;
  if (e.sources?.includes('ups')) s++;
  return s;
}

function _pickCanonical(entries) {
  if (!entries.length) return null;
  return [...entries].sort((a, b) => {
    const ae = a.email ? 1 : 0, be = b.email ? 1 : 0;
    if (ae !== be) return be - ae;
    const s = _score(b) - _score(a);
    if (s !== 0) return s;
    return String(a.key).localeCompare(String(b.key));
  })[0];
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * Sweep every source and list all account entries for a person.
 *
 * @param {string} query - email, samAccountName, display name, or claims login.
 * @param {object} [opts]
 * @param {boolean} [opts.uil=true]     - also sweep the site UIL (siteUsers).
 * @param {boolean} [opts.enrich=true]  - fetch UPS profile per entry (aliases, region). Slower.
 * @param {number}  [opts.maxEnrich=15] - cap UPS enrichment calls.
 * @returns {Promise<{ entries: object[], clusters: object[] }>}
 */
export async function findAccounts(query, opts = {}) {
  if (!query) throw new AccountFinderError('Validation', 'findAccounts: query required.');
  const { uil = true, enrich = true, maxEnrich = 15 } = opts;
  console.group(`%c[findAccounts] "${query}"`, 'font-weight:bold;font-size:12px');
  try {
    // Registry of entries keyed by claims login (Key), merged across sources.
    const byKey = new Map();
    const ensure = (key) => {
      const k = String(key);
      if (!byKey.has(k)) {
        const dc = decodeClaims(k);
        byKey.set(k, {
          key: k, sam: dc.sam, domain: dc.domain, provider: dc.claimsPrefix,
          adBacked: _adBacked(k), sources: [],
          email: '', displayName: '', siteUserId: null, principalType: '',
          entityType: '', department: '', office: '', country: '', ou: '',
          distinguishedName: '', aliases: [],
        });
      }
      return byKey.get(k);
    };
    const tag = (e, src) => { if (!e.sources.includes(src)) e.sources.push(src); };

    // -- Round 1: seed picker search by the raw query
    log('sweeping People Picker (seed)...');
    const seed = await _pickerSearch(query);
    for (const r of seed) {
      const e = ensure(r.Key);
      tag(e, 'picker');
      e.email = e.email || r.EntityData?.Email || '';
      e.displayName = e.displayName || r.DisplayText || '';
      e.principalType = e.principalType || r.EntityData?.PrincipalType || '';
      e.entityType = e.entityType || r.EntityType || '';
    }

    // -- Round 2: expand by every samAccountName discovered (catches sibling/regional/dupe entries)
    const sams = [...new Set([...byKey.values()].map(e => e.sam).filter(Boolean))];
    if (_looksLikeClaims(query)) sams.push(_sam(query));
    const samSet = [...new Set(sams)];
    log(`expanding by samAccountName: ${samSet.join(', ') || '(none)'}`);
    for (const sam of samSet) {
      for (const r of await _pickerSearch(sam)) {
        const e = ensure(r.Key);
        tag(e, 'picker');
        e.email = e.email || r.EntityData?.Email || '';
        e.displayName = e.displayName || r.DisplayText || '';
        e.principalType = e.principalType || r.EntityData?.PrincipalType || '';
        e.entityType = e.entityType || r.EntityType || '';
      }
    }

    // -- Round 3: UIL sweep (ghost/incomplete rows the picker never returns)
    if (uil) {
      log('sweeping site UIL (siteUsers)...');
      const emails = [...new Set([...byKey.values()].map(e => e.email).filter(Boolean)
        .concat(_looksLikeEmail(query) ? [String(query).trim()] : []))];
      const filters = [];
      for (const e of emails) filters.push(`Email eq '${_escOData(e)}'`);
      for (const sam of samSet) filters.push(`substringof('${_escOData(sam)}',LoginName)`);
      if (!_looksLikeEmail(query) && !_looksLikeClaims(query)) {
        filters.push(`substringof('${_escOData(query)}',Title)`); // by display name
      }
      const rows = [];
      for (const f of filters) rows.push(...await _uilByFilter(f));
      for (const u of rows) {
        if (u.PrincipalType != null && u.PrincipalType !== 1) continue; // users only (1)
        const e = ensure(u.LoginName);
        tag(e, 'uil');
        e.email = e.email || u.Email || '';
        e.displayName = e.displayName || u.Title || '';
        e.siteUserId = e.siteUserId ?? u.Id;
        e.principalType = e.principalType || String(u.PrincipalType ?? '');
        // refresh sam/domain in case UIL surfaced a login not seen via picker
        const dc = decodeClaims(u.LoginName);
        e.sam = e.sam || dc.sam; e.domain = e.domain || dc.domain;
      }
    }

    // -- Round 4: UPS enrichment (aliases + region) per entry, capped
    const entries = [...byKey.values()];
    if (enrich) {
      const toEnrich = entries.slice(0, maxEnrich);
      log(`enriching ${toEnrich.length}/${entries.length} entries via UPS (aliases, department, DN/region)...`);
      if (entries.length > maxEnrich) {
        console.warn(`[accountFinder] UPS enrichment capped at ${maxEnrich}; ${entries.length - maxEnrich} entr(ies) not enriched. Raise opts.maxEnrich to cover all.`);
      }
      for (const e of toEnrich) {
        const profile = await _ups(e.key);
        if (!profile) continue;
        const props = _profileProps(profile);
        tag(e, 'ups');
        e.email = e.email || profile.Email || '';
        e.displayName = e.displayName || profile.DisplayName || '';
        e.aliases = _aliasesFromProfile(profile, props);
        const rh = _regionHints(props);
        Object.assign(e, rh);
      }
    }

    // -- Present: master table
    console.group(`%cALL ENTRIES (${entries.length})`, 'color:#4ea1ff;font-weight:bold');
    console.table(entries.map(e => ({
      Key: e.key,
      sam: e.sam,
      domain: e.domain,
      email: e.email,
      aliases: (e.aliases || []).filter(a => a !== (e.email || '').toLowerCase()).join(', '),
      name: e.displayName,
      dept: e.department,
      office: e.office,
      region_OU: e.ou,
      siteUserId: e.siteUserId,
      adBacked: e.adBacked,
      sources: e.sources.join('+'),
    })));
    console.log('full objects:', entries);
    console.groupEnd();

    // -- Cluster by sam, sub-group by domain
    const clusters = _cluster(entries);
    console.group(`%cCLUSTERS by samAccountName (${clusters.length})`, 'color:#39d353;font-weight:bold');
    for (const c of clusters) {
      const domains = [...new Set(c.entries.map(e => e.domain || '(none)'))];
      const multiDomain = domains.length > 1;
      console.group(`%csam="${c.sam}"  |  ${c.entries.length} entr(ies)  |  domains: ${domains.join(', ')}`,
        multiDomain ? 'color:#e0a030' : 'color:#39d353');
      if (multiDomain) {
        console.warn('DIFFERENT DOMAINS under one sam -> likely DISTINCT accounts (e.g. regional EMEA/AMER). Do NOT merge across domains. Canonical suggested PER domain below.');
        // sub-cluster by domain
        for (const dom of domains) {
          const sub = c.entries.filter(e => (e.domain || '(none)') === dom);
          const canon = _pickCanonical(sub);
          console.log(`  domain ${dom}: ${sub.length} entr(ies) -> ${sub.length > 1 ? 'DUPLICATES, ' : ''}canonical =`, canon ? { Key: canon.key, email: canon.email } : null);
        }
      } else {
        const canon = _pickCanonical(c.entries);
        if (c.entries.length > 1) {
          console.log(`  ${c.entries.length} entries, one domain -> DUPLICATES/aliases. Canonical =`, canon ? { Key: canon.key, email: canon.email } : null);
        } else {
          console.log('  single entry -> canonical =', canon ? { Key: canon.key, email: canon.email } : null);
        }
      }
      console.table(c.entries.map(e => ({ Key: e.key, domain: e.domain, email: e.email, name: e.displayName, region_OU: e.ou, sources: e.sources.join('+') })));
      console.groupEnd();
    }
    console.groupEnd();

    // -- Summary guidance
    console.group('%c=> HOW TO READ THIS', 'color:#39d353;font-weight:bold');
    console.log('Same sam + same domain, multiple Keys  -> duplicates/aliases: collapse to the suggested canonical.');
    console.log('Same sam + DIFFERENT domain            -> distinct/regional accounts: keep separate (canonical per domain).');
    console.log('Entry only in "uil" (not picker)        -> ghost/incomplete UIL row; often the residual one.');
    console.log('adBacked=false                          -> not a Windows-claim AD principal; treat with suspicion.');
    console.groupEnd();

    return { query, entries, clusters };
  } catch (err) {
    console.error('[findAccounts] failed', err);
    throw err;
  } finally {
    console.groupEnd();
  }
}

function _cluster(entries) {
  const map = new Map();
  for (const e of entries) {
    const k = e.sam || `(nosam:${e.key})`;
    if (!map.has(k)) map.set(k, { sam: e.sam || '(none)', entries: [] });
    map.get(k).entries.push(e);
  }
  return [...map.values()].sort((a, b) => b.entries.length - a.entries.length);
}

function log(msg) { console.log(`%c• ${msg}`, 'color:#888'); }

// ---------------------------------------------------------------------------
// Sure-proof canonical resolve + group membership
// ---------------------------------------------------------------------------

/**
 * Gathers every principal (login) and email for a person across picker + UIL,
 * and the AD-backed (Windows-claim) candidates that are the only valid canonical
 * choices. Picker returns the real AD principal; UIL sweep surfaces ghost rows.
 */
async function _gatherIdentities(query) {
  const logins = new Set();
  const emails = new Set();
  const adByKey = new Map();

  const takePicker = (r) => {
    logins.add(r.Key);
    if (r.EntityData?.Email) emails.add(r.EntityData.Email.toLowerCase());
    if (_adBacked(r.Key)) adByKey.set(r.Key, r);
  };

  const seed = await _pickerSearch(query);
  seed.forEach(takePicker);
  if (_looksLikeEmail(query)) emails.add(String(query).trim().toLowerCase());

  const sams = new Set([...seed].map(r => _sam(r.Key)).filter(Boolean));
  if (_looksLikeClaims(query)) sams.add(_sam(query));
  for (const sam of sams) (await _pickerSearch(sam)).forEach(takePicker);

  // UIL sweep -- surfaces ghost logins the picker never returns
  const rows = [];
  for (const e of emails) rows.push(...await _uilByFilter(`Email eq '${_escOData(e)}'`));
  for (const sam of sams) rows.push(...await _uilByFilter(`substringof('${_escOData(sam)}',LoginName)`));
  for (const u of rows) {
    if (u.PrincipalType != null && u.PrincipalType !== 1) continue;
    logins.add(u.LoginName);
    if (u.Email) emails.add(u.Email.toLowerCase());
  }

  return { logins: [...logins], emails: [...emails], adAccounts: [...adByKey.values()] };
}

function _pickAdCanonical(adAccounts) {
  if (!adAccounts.length) return null;
  return [...adAccounts].sort((a, b) => {
    const ae = a.EntityData?.Email ? 1 : 0;
    const be = b.EntityData?.Email ? 1 : 0;
    if (ae !== be) return be - ae;
    return String(a.Key).localeCompare(String(b.Key));
  })[0];
}

/**
 * Sure-proof canonical resolution: returns the Windows-claim AD account the
 * picker exposes (never a UIL ghost). Warns when AD accounts span multiple
 * domains (likely distinct/regional -- do NOT merge) or when none is AD-backed.
 *
 * @param {string} query - email / sam / name / login.
 */
export async function resolveUser(query) {
  console.group(`%c[resolveUser] "${query}"`, 'font-weight:bold');
  try {
    const { adAccounts } = await _gatherIdentities(query);
    if (!adAccounts.length) {
      console.error('NO AD-backed (i:0#.w|) account found via picker. Only ghost/UIL entries exist, or the query does not resolve. This person has no authenticatable AD identity from this query.');
      return { canonical: null, adAccounts: [] };
    }
    const domains = [...new Set(adAccounts.map(r => decodeClaims(r.Key).domain))];
    if (domains.length > 1) {
      console.warn('MULTIPLE AD accounts across domains -> likely DISTINCT/regional accounts. Not merging. Candidates:', domains);
      console.table(adAccounts.map(r => ({ Key: r.Key, domain: decodeClaims(r.Key).domain, email: r.EntityData?.Email, name: r.DisplayText })));
      return { canonical: null, adAccounts, ambiguous: true, domains };
    }
    const c = _pickAdCanonical(adAccounts);
    const canonical = { key: c.Key, ...decodeClaims(c.Key), email: c.EntityData?.Email || '', name: c.DisplayText || '' };
    console.log('%cCANONICAL (AD-backed, picker) =', 'color:#39d353;font-weight:bold', canonical);
    return { canonical, adAccounts };
  } catch (err) {
    console.error('[resolveUser] failed', err);
    throw err;
  } finally {
    console.groupEnd();
  }
}

/** Query a group's members filtered by any of the given emails/logins (server-side OR). */
async function _groupMembers(groupTitle, { emails = [], logins = [] }) {
  const clauses = [];
  for (const e of emails) if (e) clauses.push(`Email eq '${_escOData(e)}'`);
  for (const l of logins) if (l) clauses.push(`LoginName eq '${_escOData(l)}'`);
  if (!clauses.length) return [];
  const selector = `getbyname('${encodeURIComponent(String(groupTitle).replace(/'/g, "''"))}')`;
  const filter = encodeURIComponent(clauses.join(' or '));
  const url = `${_webUrl()}/_api/web/sitegroups/${selector}/users?$filter=${filter}&$select=Id,LoginName,Title,Email`;
  try {
    return _unwrapCollection(_unwrapD(await _spGet(url)));
  } catch (err) {
    console.warn('[accountFinder] group members query failed', { groupTitle, err });
    return [];
  }
}

/**
 * Checks group membership for a person at two levels:
 *   - ENFORCED: is the canonical AD account (the one they authenticate as) in the group?
 *               This is what governs real SharePoint data access.
 *   - INTENT:   is ANY of the person's principals (incl. ghost UIL rows + email) in the group?
 *               Catches a grant an admin put on the wrong/ghost entry.
 * Also lists exactly WHICH principal(s) hold the grant.
 *
 * @param {string} query - email / sam / name / login.
 * @param {string} groupTitle - SharePoint group title.
 */
export async function checkGroup(query, groupTitle) {
  if (!groupTitle) throw new AccountFinderError('Validation', 'checkGroup: groupTitle required.');
  console.group(`%c[checkGroup] "${query}" in "${groupTitle}"`, 'font-weight:bold');
  try {
    const { logins, emails, adAccounts } = await _gatherIdentities(query);
    const c = _pickAdCanonical(adAccounts);
    const canonicalKey = c?.Key ?? null;

    console.log('canonical AD account:', canonicalKey ?? '(none)');
    console.log('all principals checked:', { logins, emails });

    // ENFORCED: canonical AD account only
    const enforcedRows = canonicalKey ? await _groupMembers(groupTitle, { logins: [canonicalKey] }) : [];
    const enforced = enforcedRows.length > 0;

    // INTENT: any identity
    const anyRows = await _groupMembers(groupTitle, { logins, emails });
    const intent = anyRows.length > 0;

    console.group('%c=> RESULT', 'color:#39d353;font-weight:bold');
    console.log(`%cENFORCED (canonical AD account in group -> real access): ${enforced ? 'YES' : 'NO'}`,
      enforced ? 'color:#39d353;font-weight:bold' : 'color:#ff5555;font-weight:bold');
    console.log(`%cINTENT   (any principal in group):                       ${intent ? 'YES' : 'NO'}`,
      intent ? 'color:#39d353' : 'color:#888');
    if (anyRows.length) {
      console.log('grant held by principal(s):');
      console.table(anyRows.map(r => ({
        Key: r.LoginName,
        email: r.Email,
        name: r.Title,
        adBacked: _adBacked(r.LoginName),
        isCanonical: r.LoginName === canonicalKey,
      })));
    }
    if (intent && !enforced) {
      console.warn('MISMATCH: the group grant sits on a NON-canonical (ghost) principal, NOT the AD account the user authenticates as. SPARC may show access, but actual SharePoint data access will FAIL. Fix: grant the group to the canonical AD account, or remove the ghost UIL rows.');
    }
    console.groupEnd();

    return { canonicalKey, enforced, intent, matchedPrincipals: anyRows, logins, emails };
  } catch (err) {
    console.error('[checkGroup] failed', err);
    throw err;
  } finally {
    console.groupEnd();
  }
}

// ---------------------------------------------------------------------------
// Session-authoritative primitives (the sure-proof answers)
// ---------------------------------------------------------------------------

async function _restCurrentUser() {
  return _unwrapD(await _spGet(`${_webUrl()}/_api/web/currentUser`));
}
async function _restCurrentUserGroups() {
  return _unwrapCollection(_unwrapD(await _spGet(`${_webUrl()}/_api/web/currentUser/groups`)));
}
async function _userIdByLogin(login) {
  const url = `${_webUrl()}/_api/web/siteusers`
    + `?$filter=${encodeURIComponent(`LoginName eq '${_escOData(login)}'`)}&$select=Id&$top=1`;
  try {
    const rows = _unwrapCollection(_unwrapD(await _spGet(url)));
    return rows[0]?.Id ?? null;
  } catch (err) {
    console.warn('[accountFinder] userId lookup failed', { login, err });
    return null;
  }
}

/**
 * Compares _spPageContextInfo (the JS global) against /_api/web/currentUser
 * (server-resolved from the auth token). Shows whether the session principal is
 * an AD Windows-claim account or a non-canonical "wrong" one.
 */
export async function whoAmI() {
  console.group('%c[whoAmI]', 'font-weight:bold');
  try {
    const ctx = _ctx();
    const cur = await _restCurrentUser();
    console.table([
      { field: 'LoginName', spPageContextInfo: ctx.userLoginName, currentUser_REST: cur.LoginName, match: ctx.userLoginName === cur.LoginName },
      { field: 'Id',        spPageContextInfo: ctx.userId,        currentUser_REST: cur.Id,        match: String(ctx.userId) === String(cur.Id) },
      { field: 'Email',     spPageContextInfo: ctx.userEmail,     currentUser_REST: cur.Email,     match: (ctx.userEmail || '').toLowerCase() === (cur.Email || '').toLowerCase() },
      { field: 'Title',     spPageContextInfo: ctx.userDisplayName, currentUser_REST: cur.Title,   match: '' },
    ]);
    const adBacked = _adBacked(cur.LoginName);
    console.log('session claims login:', cur.LoginName, '| adBacked (Windows claim)?', adBacked);
    if (!adBacked) {
      console.warn('SESSION IS NOT an AD Windows-claim account. You are authenticated as a non-canonical principal. SharePoint enforces access as THIS principal -- not the "real" account.');
    }
    return { ctx, currentUser: cur, adBacked };
  } catch (err) {
    console.error('[whoAmI] failed', err);
    throw err;
  } finally {
    console.groupEnd();
  }
}

/**
 * THE sure-proof list of groups for the current session. Uses
 * /_api/web/currentUser/groups -- SharePoint resolves it against your auth
 * token, so it is exactly what governs your real data access this session,
 * regardless of which account you logged in with.
 */
export async function myGroups() {
  console.group('%c[myGroups] groups for THIS session (SharePoint-authoritative)', 'font-weight:bold');
  try {
    const cur = await _restCurrentUser();
    const groups = await _restCurrentUserGroups();
    console.log('session principal:', { LoginName: cur.LoginName, Id: cur.Id, Email: cur.Email, adBacked: _adBacked(cur.LoginName) });
    console.table(groups.map(g => ({ Id: g.Id, Title: g.Title, Description: g.Description })));
    console.log('%cThis is resolved server-side from your auth token -- the sure-proof answer to "what groups am I in", and what SharePoint actually enforces.', 'color:#39d353;font-weight:bold');
    return { principal: cur, groups };
  } catch (err) {
    console.error('[myGroups] failed', err);
    throw err;
  } finally {
    console.groupEnd();
  }
}

/**
 * Shows the ACCESS GAP: the session principal's groups (enforced) vs the
 * resolved real AD account's groups. If they differ, groups on the real account
 * do NOT grant you access while logged in as the session account.
 *
 * @param {string} [query] - identifier of the real account to compare against.
 *   Defaults to the session email (the shared join key).
 */
export async function sessionVsRealGroups(query) {
  console.group('%c[sessionVsRealGroups]', 'font-weight:bold');
  try {
    const cur = await _restCurrentUser();
    const sessionGroups = await _restCurrentUserGroups();

    const { canonical, ambiguous } = await resolveUser(query ?? _ctx().userEmail ?? _sessionLogin());
    let realGroups = [];
    if (ambiguous) {
      console.warn('real account is AMBIGUOUS (multiple AD accounts across domains). Cannot pick one real account to compare -- resolve manually.');
    } else if (canonical) {
      const id = await _userIdByLogin(canonical.key);
      if (id != null) {
        realGroups = _unwrapCollection(_unwrapD(await _spGet(`${_webUrl()}/_api/web/getuserbyid(${id})/groups`)));
      } else {
        console.warn('real account has no UIL row on this site (read-only) -- its groups cannot be listed here without ensureUser (a write). Gap unknown.');
      }
    }

    const sTitles = new Set(sessionGroups.map(g => g.Title));
    const rTitles = new Set(realGroups.map(g => g.Title));
    console.log('SESSION principal:', cur.LoginName, '| adBacked:', _adBacked(cur.LoginName));
    console.log('REAL (canonical AD) principal:', canonical?.key ?? '(unresolved)');
    console.group('session groups (enforced)'); console.table(sessionGroups.map(g => ({ Title: g.Title }))); console.groupEnd();
    console.group('real-account groups'); console.table(realGroups.map(g => ({ Title: g.Title }))); console.groupEnd();

    const onlyReal = [...rTitles].filter(t => !sTitles.has(t));
    const onlySession = [...sTitles].filter(t => !rTitles.has(t));
    console.group('%c=> GAP', 'color:#e0a030;font-weight:bold');
    console.log('groups you WOULD gain if logged in as the real account (currently MISSING from your session):', onlyReal);
    console.log('groups only your session has:', onlySession);
    if (canonical && cur.LoginName !== canonical.key) {
      console.warn('Session != real account. Access is enforced on the SESSION principal. Groups only on the real account do NOT grant you access this session. Fix at deployment: grant groups to the account users actually log in with, or fix auth so they log in as the AD account.');
    }
    console.groupEnd();

    return { session: cur, sessionGroups, canonical, realGroups, onlyReal, onlySession };
  } catch (err) {
    console.error('[sessionVsRealGroups] failed', err);
    throw err;
  } finally {
    console.groupEnd();
  }
}

// ---------------------------------------------------------------------------
// Bulk discovery -- scan the whole site population, or a provided list
// ---------------------------------------------------------------------------

/** Follow OData paging (verbose __next or nometadata odata.nextLink) up to maxPages. */
async function _pageAll(url, maxPages = 20) {
  const out = [];
  let next = url;
  let pages = 0;
  while (next && pages < maxPages) {
    const data = await _spGet(next);
    const d = data?.d ?? data;
    const batch = d?.results ?? d?.value ?? (Array.isArray(d) ? d : []);
    out.push(...batch);
    next = d?.__next ?? data?.['odata.nextLink'] ?? d?.['odata.nextLink'] ?? null;
    pages++;
  }
  if (next) console.warn(`[accountFinder] paging stopped at ${maxPages} pages (${out.length} rows). Raise maxPages for more.`);
  return out;
}

/**
 * Pages the whole site user list and clusters into people with a phase-1 verdict.
 * Cheap: no picker/UPS calls. Shared by scanSiteUsers and auditSiteUsers.
 * @returns {Promise<{ total:number, clusters:object[] }>}
 */
async function _clusterSiteUsers(clusterBy = 'email', maxPages = 20) {
  const url = `${_webUrl()}/_api/web/siteusers`
    + `?$filter=${encodeURIComponent('PrincipalType eq 1')}`
    + `&$select=Id,LoginName,Title,Email,PrincipalType&$top=500`;
  const users = (await _pageAll(url, maxPages)).filter(u => u.PrincipalType === 1);

  const entries = users.map(u => {
    const dc = decodeClaims(u.LoginName);
    return {
      key: u.LoginName, sam: dc.sam, domain: dc.domain,
      email: (u.Email || '').toLowerCase(), name: (u.Title || '').trim(),
      nameLower: (u.Title || '').trim().toLowerCase(),
      siteUserId: u.Id, adBacked: _adBacked(u.LoginName),
    };
  });

  const keyOf = (e) => clusterBy === 'name' ? e.nameLower : clusterBy === 'sam' ? e.sam : e.email;
  const map = new Map();
  for (const e of entries) {
    const k = keyOf(e) || `(nokey:${e.key})`;
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(e);
  }

  const clusters = [...map.entries()].map(([k, es]) => {
    const ad = es.filter(e => e.adBacked);
    const adDomains = [...new Set(ad.map(e => e.domain))];
    let verdict;
    if (ad.length === 1) verdict = es.length > 1 ? 'RESOLVABLE (dupes)' : 'CLEAN';
    else if (ad.length === 0) verdict = 'UNRESOLVABLE (ghost)';
    else verdict = adDomains.length > 1 ? 'UNRESOLVABLE (multi-domain)' : 'AMBIGUOUS (multi same-domain)';
    return { person: k, count: es.length, adCount: ad.length, adDomains, verdict, entries: es };
  });

  return { total: users.length, clusters };
}

/**
 * Scans the ENTIRE site user list (/_api/web/siteusers), clusters people, and
 * flags those whose accounts CANNOT be cleanly resolved to a single AD identity.
 * No input list needed -- the site provides the population (and it is where
 * ghost/duplicate rows live). Cheap: pure paging + client-side clustering, no
 * per-user picker calls.
 *
 * Verdicts per person cluster:
 *   CLEAN                 - one AD account, one entry
 *   RESOLVABLE (dupes)    - one AD account + extra ghost rows (collapse to canonical)
 *   UNRESOLVABLE (ghost)  - zero AD-backed accounts (no Windows-claim anchor)
 *   UNRESOLVABLE (multi)  - multiple AD accounts across domains (distinct/regional?)
 *   AMBIGUOUS (multi)     - multiple AD accounts, same domain
 *
 * @param {object} [opts]
 * @param {'email'|'name'|'sam'} [opts.clusterBy='email'] - what groups a person's entries.
 *   email: safest (shared address). name/sam: catches accounts with different emails
 *   (e.g. one person, two regional accounts) but risks homonym false-merges.
 * @param {number}  [opts.maxPages=20]  - paging cap (500 users/page).
 * @param {boolean} [opts.onlyProblems=true] - show only unresolvable/ambiguous/dupe clusters.
 */
export async function scanSiteUsers(opts = {}) {
  const { clusterBy = 'email', maxPages = 20, onlyProblems = true } = opts;
  console.group(`%c[scanSiteUsers] clusterBy=${clusterBy}`, 'font-weight:bold');
  try {
    const { total, clusters } = await _clusterSiteUsers(clusterBy, maxPages);
    console.log(`fetched ${total} user principals from siteUsers`);

    const problems = clusters.filter(c => c.verdict !== 'CLEAN' && (c.count > 1 || c.adCount !== 1));
    console.log(`clusters: ${clusters.length} | problem clusters: ${problems.length}`);

    const show = (onlyProblems ? problems : clusters).sort((a, b) => b.count - a.count);
    console.group(`%c${onlyProblems ? 'PROBLEM' : 'ALL'} clusters (${show.length})`, 'color:#e0a030;font-weight:bold');
    console.table(show.map(c => ({ person: c.person, entries: c.count, adAccounts: c.adCount, domains: c.adDomains.join(',') || '-', verdict: c.verdict })));
    for (const c of show) {
      console.groupCollapsed(`${c.person}  --  ${c.verdict}  (${c.count} entr., ${c.adCount} AD)`);
      console.table(c.entries.map(e => ({ Key: e.key, domain: e.domain, email: e.email, name: e.name, sam: e.sam, adBacked: e.adBacked, siteUserId: e.siteUserId })));
      console.groupEnd();
    }
    console.groupEnd();

    console.group('%c=> READ', 'color:#39d353;font-weight:bold');
    console.log('UNRESOLVABLE (multi-domain): likely distinct/regional -- or a live account + a dead-domain dupe. Judge by domain.');
    console.log('UNRESOLVABLE (ghost): no Windows-claim account in this cluster -- only residual UIL rows.');
    console.log('RESOLVABLE (dupes): one real AD account + ghosts to clean up.');
    console.log('Tip: re-run with { clusterBy:\"sam\" } or { clusterBy:\"name\" } to catch people whose accounts have DIFFERENT emails.');
    console.groupEnd();

    return { total, clusters, problems };
  } catch (err) {
    console.error('[scanSiteUsers] failed', err);
    throw err;
  } finally {
    console.groupEnd();
  }
}

/**
 * Batch-resolve an explicit list of people (emails / names / logins). Heavier
 * than scanSiteUsers -- runs a full picker+UIL resolve per query. Summarizes
 * which ones are unresolvable/ambiguous.
 *
 * @param {string[]} queries
 * @param {object} [opts]
 * @param {number} [opts.throttleMs=150] - min gap between requests for this run.
 */
export async function findMany(queries, opts = {}) {
  const { throttleMs = 150 } = opts;
  const list = [].concat(queries || []).filter(Boolean);
  if (!list.length) throw new AccountFinderError('Validation', 'findMany: pass an array of emails/names/logins.');
  console.group(`%c[findMany] ${list.length} queries (throttle=${throttleMs}ms)`, 'font-weight:bold');
  console.warn(`[findMany] runs a full resolve per query (picker + UIL sweeps). ${list.length} queries = many requests.`);
  const _prevGap = _reqGapMs;
  setRequestThrottle(throttleMs);
  try {
    const results = [];
    for (const q of list) {
      const { canonical, adAccounts, ambiguous } = await resolveUser(q);
      results.push({
        query: q,
        canonical: canonical?.key ?? null,
        adAccounts: adAccounts?.length ?? 0,
        ambiguous: !!ambiguous,
        resolvable: !!canonical && !ambiguous,
      });
    }
    console.group('%c=> SUMMARY', 'color:#39d353;font-weight:bold');
    console.table(results);
    const unresolved = results.filter(r => !r.resolvable);
    console.log(`unresolvable: ${unresolved.length}/${results.length}`, unresolved.map(r => r.query));
    console.groupEnd();
    return results;
  } catch (err) {
    console.error('[findMany] failed', err);
    throw err;
  } finally {
    setRequestThrottle(_prevGap);
    console.groupEnd();
  }
}

/**
 * Deep audit: phase-1 scans the whole site user list (cheap), then deep-resolves
 * the flagged clusters (picker + UIL cross-domain, optional UPS region) to CONFIRM
 * and classify the real issues. Reports a severity-ranked list.
 *
 * Deep pass upgrades verdicts: e.g. phase-1 "RESOLVABLE" can become "MULTI-DOMAIN"
 * once picker-by-sam finds a second AD account in another domain not in this UIL.
 *
 * COST: one deep resolve per candidate = several requests each. Capped by maxPeople.
 * Deep-scans only flagged clusters by default (deep:'problems'); 'all' is expensive.
 *
 * @param {object} [opts]
 * @param {'email'|'name'|'sam'} [opts.clusterBy='email']
 * @param {number}  [opts.maxPages=20]
 * @param {'problems'|'all'|'none'} [opts.deep='problems'] - which clusters to deep-resolve.
 * @param {number}  [opts.maxPeople=40] - cap on deep resolves.
 * @param {boolean} [opts.enrich=false] - also fetch UPS region hints per AD account (slower).
 * @returns {Promise<object>} report (also saved to window.__lastAudit).
 */
export async function auditSiteUsers(opts = {}) {
  const { clusterBy = 'email', maxPages = 20, deep = 'problems', maxPeople = 200, enrich = false, throttleMs = 150 } = opts;
  console.group(`%c[auditSiteUsers] deep=${deep} clusterBy=${clusterBy} throttle=${throttleMs}ms`, 'font-weight:bold;font-size:12px');
  const _prevGap = _reqGapMs;
  setRequestThrottle(throttleMs);
  try {
    log('phase 1: scanning siteUsers (cheap)...');
    const { total, clusters } = await _clusterSiteUsers(clusterBy, maxPages);
    const problems = clusters.filter(c => c.verdict !== 'CLEAN' && (c.count > 1 || c.adCount !== 1));
    log(`${total} users -> ${clusters.length} people -> ${problems.length} flagged in phase 1`);

    let candidates = deep === 'all' ? clusters : deep === 'none' ? [] : problems;
    if (candidates.length > maxPeople) {
      console.warn(`[auditSiteUsers] deep scan capped at ${maxPeople}/${candidates.length}. Raise maxPeople for full coverage.`);
      candidates = candidates.slice(0, maxPeople);
    }
    log(`phase 2: deep-resolving ${candidates.length} cluster(s) (picker + UIL${enrich ? ' + UPS' : ''})...`);

    const issues = [];
    let i = 0;
    for (const c of candidates) {
      i++;
      const seed = c.entries.find(e => e.email)?.email
        || c.entries.find(e => e.adBacked)?.key
        || c.entries[0].key;
      let deepRes;
      try {
        deepRes = await _gatherIdentities(seed);
      } catch (err) {
        console.warn('[auditSiteUsers] deep resolve failed, skipping', { seed, err });
        continue;
      }
      const ad = deepRes.adAccounts;
      const adDomains = [...new Set(ad.map(r => decodeClaims(r.Key).domain))];
      const ghostLogins = deepRes.logins.filter(l => !_adBacked(l));

      let verdict, severity;
      if (adDomains.length > 1)      { verdict = 'MULTI-DOMAIN AD (distinct/regional or dead-domain dup)'; severity = 'high'; }
      else if (ad.length === 0)      { verdict = 'NO AD ANCHOR (ghost-only)'; severity = 'high'; }
      else if (ad.length > 1)        { verdict = 'MULTIPLE AD same-domain'; severity = 'med'; }
      else if (ghostLogins.length)   { verdict = 'resolvable + ghosts to clean'; severity = 'low'; }
      else                           { verdict = 'clean (deep)'; severity = 'none'; }

      let region;
      if (enrich && ad.length) {
        region = [];
        for (const r of ad) {
          const p = await _ups(r.Key);
          if (p) region.push({ key: r.Key, ..._regionHints(_profileProps(p)) });
        }
      }

      if (severity !== 'none') {
        issues.push({
          person: c.person, phase1: c.verdict, verdict, severity,
          adCount: ad.length, domains: adDomains.join(',') || '-',
          principals: deepRes.logins.length, ghosts: ghostLogins.length,
          adKeys: ad.map(r => r.Key), emails: deepRes.emails, region,
        });
      }
      if (i % 10 === 0) log(`  ...${i}/${candidates.length}`);
    }

    const order = { high: 0, med: 1, low: 2 };
    issues.sort((a, b) => order[a.severity] - order[b.severity]);

    console.group(`%c=> ISSUES (${issues.length})`, 'color:#e0a030;font-weight:bold');
    console.table(issues.map(r => ({
      person: r.person, severity: r.severity, verdict: r.verdict,
      adCount: r.adCount, domains: r.domains, principals: r.principals, ghosts: r.ghosts,
    })));
    for (const r of issues) {
      console.groupCollapsed(`[${r.severity}] ${r.person} -- ${r.verdict}`);
      console.log(r);
      console.groupEnd();
    }
    console.groupEnd();

    const report = {
      site: _webUrl(), total, people: clusters.length,
      phase1Problems: problems.length, deepScanned: candidates.length, issues,
    };
    window.__lastAudit = report;
    console.log('%cfull report saved to window.__lastAudit -- export with: copy(JSON.stringify(window.__lastAudit, null, 2))', 'color:#39d353');
    return report;
  } catch (err) {
    console.error('[auditSiteUsers] failed', err);
    throw err;
  } finally {
    setRequestThrottle(_prevGap); // restore prior throttle
    console.groupEnd();
  }
}

// ---------------------------------------------------------------------------
// Console exposure
// ---------------------------------------------------------------------------

window.auditSiteUsers = auditSiteUsers;
window.setRequestThrottle = setRequestThrottle;
window.scanSiteUsers = scanSiteUsers;
window.findMany = findMany;
window.whoAmI = whoAmI;
window.myGroups = myGroups;
window.sessionVsRealGroups = sessionVsRealGroups;
window.resolveUser = resolveUser;
window.checkGroup = checkGroup;
window.findAccounts = findAccounts;
window.decodeClaims = decodeClaims;
window.AccountFinderError = AccountFinderError;

console.log('[accountFinder] loaded.');
console.log('  await findAccounts(email|sam|name|login, { uil?, enrich?, maxEnrich? })');
console.log('    -- sweeps People Picker + site UIL + UPS profile; clusters by sam, sub-groups by domain');
console.log('  await resolveUser(email|sam|name|login)');
console.log('    -- sure-proof canonical: the Windows-claim AD account (never a UIL ghost)');
console.log('  await checkGroup(email|sam|name|login, groupTitle)');
console.log('    -- ENFORCED (canonical AD in group = real access) vs INTENT (any principal); shows who holds the grant');
console.log('  await whoAmI()              -- _spPageContextInfo vs /_api/web/currentUser; is the session an AD account?');
console.log('  await myGroups()            -- SURE-PROOF groups for THIS session (/_api/web/currentUser/groups)');
console.log('  await sessionVsRealGroups() -- access gap: session groups vs the real AD account groups');
console.log('  await scanSiteUsers({ clusterBy?, maxPages?, onlyProblems? })');
console.log('    -- scans the WHOLE site user list; flags people whose accounts cannot be resolved (no input list needed)');
console.log('  await findMany([email|name|login, ...]) -- batch resolve an explicit list; flags the unresolvable ones');
console.log('  await auditSiteUsers({ deep?, clusterBy?, maxPeople?, enrich?, throttleMs? })');
console.log('    -- phase-1 scan + deep-resolve flagged clusters; severity-ranked issue report (-> window.__lastAudit)');
console.log('    -- default maxPeople=200, throttleMs=150 (paces ALL requests, auto-retries HTTP 429/503)');
console.log('  setRequestThrottle(ms) -- global gap between ALL requests (0 = off); applies to every function');
