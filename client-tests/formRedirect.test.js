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
// 5. Content-type form-URL override (the documented custom-form mechanism).
//    Unlike list.DefaultNewFormUrl, ContentType.NewFormUrl does NOT require the
//    target to be an existing SPForm -- it overrides which page the New/Edit
//    button opens. This is the real "redirect to a custom page" path, if the
//    property is client-writable in this environment.
// ---------------------------------------------------------------------------

async function getCTForms(listName) {
  await loadJSOM();
  const ctx = SP.ClientContext.get_current();
  const cts = ctx.get_web().get_lists().getByTitle(listName).get_contentTypes();
  ctx.load(cts, 'Include(Name,Id,NewFormUrl,EditFormUrl,DisplayFormUrl)');
  await _execQuery(ctx);
  const out = [];
  const e = cts.getEnumerator();
  while (e.moveNext()) {
    const c = e.get_current();
    out.push({
      name: c.get_name(),
      newFormUrl: c.get_newFormUrl(),
      editFormUrl: c.get_editFormUrl(),
      displayFormUrl: c.get_displayFormUrl(),
    });
  }
  console.log('[getCTForms]', listName, out);
  return out;
}

async function setCTFormsJSOM(listName, url = _defaultRedirectUrl()) {
  await loadJSOM();
  const ctx = SP.ClientContext.get_current();
  const cts = ctx.get_web().get_lists().getByTitle(listName).get_contentTypes();
  ctx.load(cts);
  await _execQuery(ctx);
  if (cts.get_count() === 0) throw new Error('List has no content types.');

  const ct = cts.itemAt(0); // primary/default content type
  if (typeof ct.set_newFormUrl !== 'function') {
    throw new Error('SP.ContentType has no set_newFormUrl in this JSOM build -- property not client-writable here.');
  }
  ct.set_newFormUrl(url);
  ct.set_editFormUrl(url);
  ct.update(false); // false = do not push to child content types
  try {
    await _execQuery(ctx);
    console.log(`%c[setCTFormsJSOM] content-type form override SUCCEEDED on ${listName} -> ${url}`, 'color:green');
  } catch (e) {
    console.error('[setCTFormsJSOM] content-type override FAILED:', e.message);
    throw e;
  }
  return getCTForms(listName);
}

async function restoreCTFormsJSOM(listName) {
  await loadJSOM();
  const ctx = SP.ClientContext.get_current();
  const cts = ctx.get_web().get_lists().getByTitle(listName).get_contentTypes();
  ctx.load(cts);
  await _execQuery(ctx);
  const ct = cts.itemAt(0);
  ct.set_newFormUrl('');
  ct.set_editFormUrl('');
  ct.update(false);
  await _execQuery(ctx);
  console.log(`[restoreCTFormsJSOM] cleared content-type form overrides on ${listName}`);
  return getCTForms(listName);
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
    console.log('--- 4. JSOM write via list.DefaultNewFormUrl (expected: SPForm rejection) ---');
    try {
      verdict.after = await setFormsJSOM(listName, url);
      verdict.defaultUrlWrite = 'ok';
    } catch (e) {
      verdict.defaultUrlWrite = 'failed: ' + e.message;
    }

    console.log('--- 5. JSOM write via ContentType.NewFormUrl (the real redirect path) ---');
    try {
      verdict.ctBefore = await getCTForms(listName);
      verdict.ctAfter = await setCTFormsJSOM(listName, url);
      verdict.ctWrite = 'ok';
    } catch (e) {
      verdict.ctWrite = 'failed: ' + e.message;
    }
  } else {
    verdict.defaultUrlWrite = 'skipped -- JSOM not available';
    verdict.ctWrite = 'skipped -- JSOM not available';
  }

  const restBlocked = verdict.rest && !verdict.rest.ok;
  const defaultWorks = verdict.defaultUrlWrite === 'ok';
  const ctWorks = verdict.ctWrite === 'ok';
  console.log('%c=== VERDICT ===', 'font-weight:bold');
  console.log('REST write blocked        :', restBlocked ? `YES (${verdict.rest.status})` : 'no');
  console.log('JSOM available            :', verdict.jsom.loadable ? 'YES' : 'NO');
  console.log('list.DefaultNewFormUrl set:', defaultWorks ? 'YES' : 'NO (only accepts the list\'s own forms)');
  console.log('ContentType.NewFormUrl set:', ctWorks ? 'YES' : 'NO');
  if (ctWorks) {
    console.log('%cForm redirect IS achievable via ContentType.NewFormUrl (JSOM). This is the path to wire into setup.', 'color:green');
    console.log('Undo with restoreCTFormsJSOM("' + listName + '"). Also click the list\'s New/Edit button to confirm it actually redirects.');
  } else if (verdict.jsom.loadable) {
    console.log('%cJSOM loads but neither form-URL property is client-writable here. Browser-based redirect not viable -- fall back to PowerShell-at-deploy or drop the toggle.', 'color:orange');
  } else {
    console.log('%cJSOM not available/allowed -- form redirect cannot be done from the browser.', 'color:red');
  }
  return verdict;
}

// ---------------------------------------------------------------------------
// 6. Robust redirect via a web-scoped ScriptLink UserCustomAction.
//
//    Why this instead of ContentType.NewFormUrl: pointing the content type's
//    form at app.aspx makes SharePoint treat app.aspx AS the list's form and
//    form-render it in the live list context -- which 500s server-side once a
//    real List GUID is on the URL. This approach keeps SharePoint's REAL
//    NewForm.aspx/EditForm.aspx (they render fine), and injects a guarded
//    script that redirects to the app on load. REST-addable; requires the site
//    to permit custom script (ScriptLink). If it 403s, custom script is denied.
// ---------------------------------------------------------------------------

const REDIRECT_ACTION_NAME = 'SPARC_FormRedirect';

async function _getListId(listName) {
  const res = await fetch(`${_listEndpoint(listName)}?$select=Id`, {
    headers: { Accept: 'application/json;odata=nometadata' },
  });
  if (!res.ok) throw new Error(`getListId failed (${res.status})`);
  const id = (JSON.parse(await res.text()).Id || '').replace(/[{}]/g, '').toLowerCase();
  if (!id) throw new Error('list Id not returned');
  return id;
}

// Guarded redirect: only fires on the target list's New/Edit form pages.
function _redirectScriptBlock(listId, appUrl) {
  return [
    '(function(){try{',
    ' var c=window._spPageContextInfo||{};',
    ' var lid=(c.pageListId||"").replace(/[{}]/g,"").toLowerCase();',
    ' if(lid!==' + JSON.stringify(listId) + ')return;',
    ' var p=(location.pathname||"").toLowerCase();',
    ' if(p.indexOf("/newform.aspx")>-1||p.indexOf("/editform.aspx")>-1){',
    '  window.location.replace(' + JSON.stringify(appUrl) + ');',
    ' }',
    '}catch(e){console.warn("[SPARC_FormRedirect]",e);}})();',
  ].join('');
}

async function listCustomActions(scope = 'web', listName) {
  const base = scope === 'list' ? _listEndpoint(listName) : `${_webUrl()}/_api/web`;
  const res = await fetch(`${base}/UserCustomActions?$select=Id,Name,Title,Location,Sequence`, {
    headers: { Accept: 'application/json;odata=nometadata' },
  });
  const items = JSON.parse(await res.text()).value ?? [];
  console.log(`[listCustomActions:${scope}]`, items);
  return items;
}

async function addFormRedirectAction(listName, appUrl = _defaultRedirectUrl()) {
  const listId = await _getListId(listName);
  const res = await fetch(`${_webUrl()}/_api/web/UserCustomActions`, {
    method: 'POST',
    headers: {
      Accept: 'application/json;odata=verbose',
      'Content-Type': 'application/json;odata=verbose',
      'X-RequestDigest': _digest(),
    },
    body: JSON.stringify({
      __metadata: { type: 'SP.UserCustomAction' },
      Title: REDIRECT_ACTION_NAME,
      Name: REDIRECT_ACTION_NAME + '_' + listId,
      Location: 'ScriptLink',
      ScriptBlock: _redirectScriptBlock(listId, appUrl),
      Sequence: 100,
    }),
  });
  const body = await res.text();
  if (!res.ok) {
    let msg = body; try { msg = JSON.parse(body)?.error?.message?.value ?? body; } catch { /* raw */ }
    console.error(`[addFormRedirectAction] ${res.status}:`, msg);
    throw new Error(`add ScriptLink failed (${res.status}): ${msg}`);
  }
  console.log(`%c[addFormRedirectAction] web ScriptLink added, guarded to list ${listId} -> ${appUrl}`, 'color:green');
  console.log('Now click New/Edit on "' + listName + '" -- native form renders briefly then redirects. Undo: removeFormRedirectActions("' + listName + '")');
  return JSON.parse(body);
}

async function removeFormRedirectActions(listName) {
  let listId = null;
  try { listId = await _getListId(listName); } catch { /* list may be gone */ }
  const actions = await listCustomActions('web');
  const mine = actions.filter(a =>
    a.Title === REDIRECT_ACTION_NAME ||
    a.Name === REDIRECT_ACTION_NAME ||
    (listId && a.Name === REDIRECT_ACTION_NAME + '_' + listId)
  );
  for (const a of mine) {
    const res = await fetch(`${_webUrl()}/_api/web/UserCustomActions(guid'${a.Id}')`, {
      method: 'POST',
      headers: { 'X-RequestDigest': _digest(), 'IF-MATCH': '*', 'X-HTTP-Method': 'DELETE' },
    });
    if (!res.ok) console.error('[removeFormRedirectActions] delete failed', a.Id, res.status);
    else console.log('[removeFormRedirectActions] removed', a.Id);
  }
  if (!mine.length) console.log('[removeFormRedirectActions] none found');
  return mine.length;
}

// All-in-one for the custom-action path. Remove any CT override first so the
// two mechanisms don't fight.
async function runActionProbe(listName, url = _defaultRedirectUrl()) {
  if (!listName) { console.error('runActionProbe(listName[, url])'); return; }
  console.log('%c=== ScriptLink redirect probe: ' + listName + ' ===', 'font-weight:bold');
  try {
    await addFormRedirectAction(listName, url);
    console.log('%cScriptLink added. Click the list\'s New/Edit to confirm it redirects (native form flashes, then app).', 'color:green');
    return { added: true };
  } catch (e) {
    console.log('%cScriptLink add failed -- likely custom script denied in this env: ' + e.message, 'color:red');
    return { added: false, error: e.message };
  }
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
  getCTForms,
  setCTFormsJSOM,
  restoreCTFormsJSOM,
  runActionProbe,
  addFormRedirectAction,
  removeFormRedirectActions,
  listCustomActions,
});

console.log(
  '[formRedirect.test] loaded. Run: await runProbe("<throwaway-list>")\n' +
  'Exposed: runProbe, getFormUrls, reproduceRESTError, jsomAvailable, setFormsJSOM, restoreFormsJSOM'
);
