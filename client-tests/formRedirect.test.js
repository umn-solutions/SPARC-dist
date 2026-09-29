/**
 * Form-redirect feasibility probe -- can we set a list's New/Edit form URLs?
 *
 * Background: SPARC setup's "Redirect Forms" toggle MERGEs DefaultNewFormUrl /
 * DefaultEditFormUrl on the list via REST. On-prem SharePoint returns 400 --
 * these properties are READ-ONLY through the REST API (setters exist only in
 * CSOM/JSOM). This probe answers, in YOUR environment:
 *
 *   1. Does the REST write really 400?           -> reproduceRESTError(list)
 *   2. Is JSOM (SP.ClientContext) even available? -> jsomAvailable()
 *   3. Can JSOM set the form URLs?                -> setFormsJSOM(list, url)
 *   4. Did the value actually persist?            -> getFormUrls(list)
 *
 * It mutates a list's form-URL properties. Use a THROWAWAY/test list, not a
 * production one. restoreFormsJSOM(list) clears them back to default.
 *
 * No SPARC imports, no jQuery. Vanilla fetch for REST + the SharePoint JSOM
 * runtime (loaded on demand from /_layouts/15/) for the CSOM path.
 *
 * Load (browser console, on any page of the SharePoint site):
 *   await import('/<your-site>/client-tests/formRedirect.test.js');
 *
 * Then run the all-in-one:
 *   await runProbe('MyTestList');          // reproduces REST 400, tries JSOM, verifies
 *   await runProbe('MyTestList', '/sites/x/SitePages/index.html');  // custom redirect target
 *
 * Or the pieces (all exposed on window):
 *   await jsomAvailable();                 // { present, loadable, version }
 *   await getFormUrls('MyTestList');       // current New/Edit/Display form URLs (REST GET)
 *   await reproduceRESTError('MyTestList');// the exact 400 body, for the record
 *   await setFormsJSOM('MyTestList', url); // set via JSOM; resolves on success, throws CSOM error
 *   await restoreFormsJSOM('MyTestList');  // clear the overrides back to default
 */

// ---------------------------------------------------------------------------
// Config / helpers
// ---------------------------------------------------------------------------

const _webUrl = () =>
  (window._spPageContextInfo?.webAbsoluteUrl ?? location.origin).replace(/\/$/, '');

// Default redirect target = the SPARC app page (same shape as setup's APP_URL).
const _defaultRedirectUrl = () => {
  const web = _webUrl();
  try {
    return new URL(web).pathname + '/SitePages/index.html';
  } catch {
    return web + '/SitePages/index.html';
  }
};

const _digest = () => {
  const el = document.getElementById('__REQUESTDIGEST');
  if (el?.value) return el.value;
  if (window._spPageContextInfo?.formDigestValue) return _spPageContextInfo.formDigestValue;
  throw new Error('No request digest on page. Run this on a SharePoint page that has #__REQUESTDIGEST.');
};

const _escq = (s) => String(s).replace(/'/g, "''");
const _listEndpoint = (listName) => `${_webUrl()}/_api/web/lists/getbytitle('${_escq(listName)}')`;

// ---------------------------------------------------------------------------
// 1. Read current form URLs (REST GET -- this works; only writes are blocked)
// ---------------------------------------------------------------------------

async function getFormUrls(listName) {
  const url = `${_listEndpoint(listName)}?$select=DefaultNewFormUrl,DefaultEditFormUrl,DefaultDisplayFormUrl`;
  const res = await fetch(url, { headers: { Accept: 'application/json;odata=nometadata' } });
  const text = await res.text();
  if (!res.ok) {
    console.error('[getFormUrls] GET failed', res.status, text);
    throw new Error(`GET form urls failed (${res.status})`);
  }
  const data = JSON.parse(text);
  const out = {
    DefaultNewFormUrl: data.DefaultNewFormUrl ?? '',
    DefaultEditFormUrl: data.DefaultEditFormUrl ?? '',
    DefaultDisplayFormUrl: data.DefaultDisplayFormUrl ?? '',
  };
  console.log('[getFormUrls]', listName, out);
  return out;
}

// ---------------------------------------------------------------------------
// 2. Reproduce the REST 400 -- capture the exact SharePoint error body
// ---------------------------------------------------------------------------

async function reproduceRESTError(listName, url = _defaultRedirectUrl()) {
  const res = await fetch(_listEndpoint(listName), {
    method: 'POST',
    headers: {
      Accept: 'application/json;odata=verbose',
      'Content-Type': 'application/json;odata=verbose',
      'X-RequestDigest': _digest(),
      'IF-MATCH': '*',
      'X-HTTP-Method': 'MERGE',
    },
    body: JSON.stringify({
      __metadata: { type: 'SP.List' },
      DefaultNewFormUrl: url,
      DefaultEditFormUrl: url,
    }),
  });
  const body = await res.text();
  let message = body;
  try { message = JSON.parse(body)?.error?.message?.value ?? body; } catch { /* keep raw */ }
  const result = { ok: res.ok, status: res.status, message, raw: body };
  if (res.ok) {
    console.log('%c[reproduceRESTError] REST WRITE SUCCEEDED (unexpected)', 'color:green', result);
  } else {
    console.error(`[reproduceRESTError] REST write -> ${res.status}. SharePoint says:`, message);
  }
  return result;
}

// ---------------------------------------------------------------------------
// 3. JSOM availability + loader
// ---------------------------------------------------------------------------

function _loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve(src);
    s.onerror = () => reject(new Error('Failed to load ' + src));
    document.head.appendChild(s);
  });
}

// Ensure SP.ClientContext exists. Returns true, or throws with the reason.
async function loadJSOM() {
  if (window.SP && window.SP.ClientContext) return true;

  // Preferred: script-on-demand if the SP runtime is partially present.
  if (window.SP && window.SP.SOD && typeof SP.SOD.executeFunc === 'function') {
    await new Promise((resolve) => SP.SOD.executeFunc('sp.js', 'SP.ClientContext', resolve));
    if (window.SP && SP.ClientContext) return true;
  }

  // Fallback: load the JSOM runtime from _layouts in dependency order.
  const base = location.origin + '/_layouts/15/';
  await _loadScript(base + 'init.js');
  await _loadScript(base + 'sp.runtime.js');
  await _loadScript(base + 'sp.js');

  if (window.SP && SP.ClientContext) return true;
  throw new Error('JSOM scripts loaded but SP.ClientContext is still undefined (env may block JSOM).');
}

async function jsomAvailable() {
  const present = !!(window.SP && window.SP.ClientContext);
  let loadable = present;
  let error = null;
  if (!present) {
    try { loadable = await loadJSOM(); }
    catch (e) { loadable = false; error = e.message; }
  }
  const version = window.SP?.ClientRuntimeContext ? (window._spPageContextInfo?.webUIVersion ?? 'unknown') : null;
  const out = { present, loadable, version, error };
  console.log('[jsomAvailable]', out);
  return out;
}

// ---------------------------------------------------------------------------
// 4. Set / restore form URLs via JSOM (the only browser path that can write)
// ---------------------------------------------------------------------------

function _execQuery(ctx) {
  return new Promise((resolve, reject) => {
    ctx.executeQueryAsync(
      () => resolve(),
      (_sender, args) => reject(new Error(args?.get_message?.() || 'executeQueryAsync failed'))
    );
  });
}

async function setFormsJSOM(listName, url = _defaultRedirectUrl()) {
  await loadJSOM();
  const ctx = SP.ClientContext.get_current();
  const list = ctx.get_web().get_lists().getByTitle(listName);

  if (typeof list.set_defaultNewFormUrl !== 'function') {
    throw new Error('SP.List has no set_defaultNewFormUrl in this JSOM build -- property not client-writable here.');
  }
  list.set_defaultNewFormUrl(url);
  list.set_defaultEditFormUrl(url);
  list.update();

  try {
    await _execQuery(ctx);
    console.log(`%c[setFormsJSOM] JSOM write SUCCEEDED on ${listName} -> ${url}`, 'color:green');
  } catch (e) {
    console.error('[setFormsJSOM] JSOM write FAILED:', e.message);
    throw e;
  }
  return getFormUrls(listName);
}

async function restoreFormsJSOM(listName) {
  await loadJSOM();
  const ctx = SP.ClientContext.get_current();
  const list = ctx.get_web().get_lists().getByTitle(listName);
  list.set_defaultNewFormUrl('');
  list.set_defaultEditFormUrl('');
  list.update();
  await _execQuery(ctx);
  console.log(`[restoreFormsJSOM] cleared overrides on ${listName}`);
  return getFormUrls(listName);
}

// ---------------------------------------------------------------------------
// All-in-one probe
// ---------------------------------------------------------------------------

async function runProbe(listName, url = _defaultRedirectUrl()) {
  if (!listName) {
    console.error('runProbe(listName[, url]) -- pass a THROWAWAY list title to mutate.');
    return;
  }
  console.log('%c=== Form-redirect probe: ' + listName + ' ===', 'font-weight:bold');
  const verdict = { list: listName, target: url };

  console.log('--- 1. current form URLs (before) ---');
  try { verdict.before = await getFormUrls(listName); }
  catch (e) { verdict.before = { error: e.message }; }

  console.log('--- 2. REST write (expected 400) ---');
  verdict.rest = await reproduceRESTError(listName, url);

  console.log('--- 3. JSOM availability ---');
  verdict.jsom = await jsomAvailable();

  if (verdict.jsom.loadable) {
    console.log('--- 4. JSOM write ---');
    try {
      verdict.after = await setFormsJSOM(listName, url);
      verdict.jsomWrite = 'ok';
    } catch (e) {
      verdict.jsomWrite = 'failed: ' + e.message;
    }
  } else {
    verdict.jsomWrite = 'skipped -- JSOM not available';
  }

  const restBlocked = verdict.rest && !verdict.rest.ok;
  const jsomWorks = verdict.jsomWrite === 'ok';
  console.log('%c=== VERDICT ===', 'font-weight:bold');
  console.log('REST write blocked  :', restBlocked ? `YES (${verdict.rest.status})` : 'no');
  console.log('JSOM available      :', verdict.jsom.loadable ? 'YES' : 'NO');
  console.log('JSOM write worked   :', jsomWorks ? 'YES' : 'NO');
  if (jsomWorks) {
    console.log('%cForm redirect is achievable via JSOM in this environment.', 'color:green');
    console.log('Run restoreFormsJSOM("' + listName + '") to undo.');
  } else if (verdict.jsom.loadable) {
    console.log('%cJSOM loads but the write failed -- see error above (likely governance/permission).', 'color:orange');
  } else {
    console.log('%cJSOM is not available/allowed here -- form redirect cannot be done from the browser.', 'color:red');
  }
  return verdict;
}

// ---------------------------------------------------------------------------
// Expose
// ---------------------------------------------------------------------------

Object.assign(window, {
  runProbe,
  getFormUrls,
  reproduceRESTError,
  jsomAvailable,
  loadJSOM,
  setFormsJSOM,
  restoreFormsJSOM,
});

console.log(
  '[formRedirect.test] loaded. Run: await runProbe("<throwaway-list>")\n' +
  'Exposed: runProbe, getFormUrls, reproduceRESTError, jsomAvailable, setFormsJSOM, restoreFormsJSOM'
);
