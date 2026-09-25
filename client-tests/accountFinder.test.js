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

async function _spGet(url) {
  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json;odata=verbose' },
    credentials: 'include',
  });
  const text = await res.text();
  if (!res.ok) {
    throw new AccountFinderError('HttpError', `GET ${url} -> HTTP ${res.status}`, { status: res.status, body: text });
  }
  return text ? JSON.parse(text) : null;
}

async function _spPost(url, payload) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json;odata=verbose',
      'Content-Type': 'application/json;odata=verbose',
      'X-RequestDigest': _getDigest(),
    },
    body: JSON.stringify(payload),
    credentials: 'include',
  });
  const text = await res.text();
  if (!res.ok) {
    throw new AccountFinderError('HttpError', `POST ${url} -> HTTP ${res.status}`, { status: res.status, body: text });
  }
  return text ? JSON.parse(text) : null;
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
// Console exposure
// ---------------------------------------------------------------------------

window.findAccounts = findAccounts;
window.decodeClaims = decodeClaims;
window.AccountFinderError = AccountFinderError;

console.log('[accountFinder] loaded.');
console.log('  await findAccounts(email|sam|name|login, { uil?, enrich?, maxEnrich? })');
console.log('    -- sweeps People Picker + site UIL + UPS profile; clusters by sam, sub-groups by domain');
