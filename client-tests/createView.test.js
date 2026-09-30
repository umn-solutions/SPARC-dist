/**
 * List-view creation probe -- debug why setup's "create view" fails.
 *
 * Setup creates the Admin view via POST .../views with body
 *   { Title, PersonalView, TabularView }
 * but spPOST sends Content-Type application/json;odata=verbose, which REQUIRES
 * `__metadata: { type: 'SP.View' }` on the payload. Without it SharePoint
 * returns 400 -- the same failure class as the quick-edit 400. This probe:
 *
 *   1. Reproduces the buggy create (no __metadata)      -> reproduceBuggyCreate(list)
 *   2. Creates a view the correct way (with __metadata)  -> createView(list, name)
 *   3. Fills it with all the list's fields               -> addAllFields(list, name)
 *   4. Reads the view's fields back to confirm           -> getViewFields(list, name)
 *
 * "All fields" = the list's live queryable fields (Hidden eq false and
 * ReadOnlyField eq false) -- for a schema-provisioned list these ARE your
 * schema.js fields. Pass an explicit `fields` array to override.
 *
 * No SPARC imports. Vanilla fetch + the page request digest.
 *
 * Load (console, on any page of the SharePoint site):
 *   await import('/<your-site>/client-tests/createView.test.js');
 *
 * All-in-one (creates a test view, fills it, prints a URL to open):
 *   await runViewTest('Tasks');
 *   await runViewTest('Tasks', { viewName: 'My View', personal: false });
 *   await runViewTest('Tasks', { fields: ['Title','Status','AssignedTo','DueDate'] });
 *   await deleteView('Tasks', 'SPARC_TestView');   // cleanup
 *
 * Pieces (all on window):
 *   getListFields, reproduceBuggyCreate, createView, clearViewFields,
 *   addViewField, addAllFields, getViewFields, deleteView
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const _webUrl = () =>
  (window._spPageContextInfo?.webAbsoluteUrl ?? location.origin).replace(/\/$/, '');

const _digest = () => {
  const el = document.getElementById('__REQUESTDIGEST');
  if (el?.value) return el.value;
  if (window._spPageContextInfo?.formDigestValue) return _spPageContextInfo.formDigestValue;
  throw new Error('No request digest on page. Run on a SharePoint page with #__REQUESTDIGEST.');
};

const _escq = (s) => String(s).replace(/'/g, "''");
const _listEndpoint = (listName) => `${_webUrl()}/_api/web/lists/getbytitle('${_escq(listName)}')`;

async function _get(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json;odata=nometadata' } });
  const text = await res.text();
  if (!res.ok) { console.error('[GET]', res.status, url, text); throw new Error(`GET ${res.status}`); }
  return text ? JSON.parse(text) : null;
}

// POST an ENTITY (needs odata=verbose + __metadata). Returns {ok,status,message,raw}.
async function _postEntity(url, data) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json;odata=verbose',
      'Content-Type': 'application/json;odata=verbose',
      'X-RequestDigest': _digest(),
    },
    body: JSON.stringify(data),
  });
  const raw = await res.text();
  let message = raw;
  try { message = JSON.parse(raw)?.error?.message?.value ?? raw; } catch { /* keep raw */ }
  return { ok: res.ok, status: res.status, message, raw };
}

// POST an ACTION method (no entity body), e.g. addviewfield / removeallviewfields.
async function _postAction(url) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { Accept: 'application/json;odata=nometadata', 'X-RequestDigest': _digest() },
  });
  const raw = await res.text();
  let message = raw;
  try { message = JSON.parse(raw)?.error?.message?.value ?? raw; } catch { /* keep raw */ }
  return { ok: res.ok, status: res.status, message, raw };
}

// ---------------------------------------------------------------------------
// Fields
// ---------------------------------------------------------------------------

async function getListFields(listName) {
  const url = `${_listEndpoint(listName)}/fields?$select=InternalName,Title,TypeAsString,Hidden,ReadOnlyField&$filter=Hidden eq false and ReadOnlyField eq false`;
  const data = await _get(url);
  const fields = (data.value ?? []).map(f => ({ InternalName: f.InternalName, Title: f.Title, Type: f.TypeAsString }));
  console.log(`[getListFields] ${listName}: ${fields.length} queryable fields`, fields.map(f => f.InternalName));
  return fields;
}

// ---------------------------------------------------------------------------
// 1. Reproduce the buggy create (no __metadata) -- expected 400
// ---------------------------------------------------------------------------

async function reproduceBuggyCreate(listName, viewName = 'SPARC_TestView_bug') {
  const r = await _postEntity(`${_listEndpoint(listName)}/views`, {
    Title: viewName, PersonalView: false, TabularView: true, // NOTE: no __metadata (the bug)
  });
  if (r.ok) {
    console.log('%c[reproduceBuggyCreate] create SUCCEEDED without __metadata (unexpected)', 'color:orange', r);
    await deleteView(listName, viewName); // clean up the accidental view
  } else {
    console.error(`[reproduceBuggyCreate] create -> ${r.status}. SharePoint says:`, r.message);
  }
  return r;
}

// ---------------------------------------------------------------------------
// 2. Create a view the correct way (with __metadata: SP.View)
// ---------------------------------------------------------------------------

async function createView(listName, viewName = 'SPARC_TestView', opts = {}) {
  const { personal = false, rowLimit = 100 } = opts;
  const r = await _postEntity(`${_listEndpoint(listName)}/views`, {
    __metadata: { type: 'SP.View' },
    Title: viewName,
    PersonalView: personal,
    RowLimit: rowLimit,
    ViewQuery: '',
  });
  if (!r.ok) {
    console.error(`[createView] FAILED ${r.status}:`, r.message);
    throw new Error(`createView failed (${r.status}): ${r.message}`);
  }
  console.log(`%c[createView] created "${viewName}" on ${listName} (personal=${personal})`, 'color:green');
  return r;
}

// ---------------------------------------------------------------------------
// 3. View fields
// ---------------------------------------------------------------------------

const _viewEndpoint = (listName, viewName) =>
  `${_listEndpoint(listName)}/views/getbytitle('${_escq(viewName)}')`;

async function clearViewFields(listName, viewName) {
  const r = await _postAction(`${_viewEndpoint(listName, viewName)}/viewfields/removeallviewfields`);
  if (!r.ok) console.error('[clearViewFields] failed', r.status, r.message);
  else console.log(`[clearViewFields] cleared default fields on "${viewName}"`);
  return r;
}

async function addViewField(listName, viewName, internalName) {
  const r = await _postAction(`${_viewEndpoint(listName, viewName)}/viewfields/addviewfield('${_escq(internalName)}')`);
  if (!r.ok) console.error(`[addViewField] ${internalName} failed`, r.status, r.message);
  return r;
}

async function addAllFields(listName, viewName, fields) {
  const list = fields || (await getListFields(listName)).map(f => f.InternalName);
  await clearViewFields(listName, viewName);
  let added = 0, failed = 0;
  for (const name of list) {
    const r = await addViewField(listName, viewName, name);
    if (r.ok) { added++; console.log('  + ' + name); } else { failed++; }
  }
  console.log(`[addAllFields] "${viewName}": added ${added}, failed ${failed}`);
  return { added, failed };
}

async function getViewFields(listName, viewName) {
  const data = await _get(`${_viewEndpoint(listName, viewName)}/viewfields`);
  const items = data?.Items?.results ?? data?.Items ?? data?.value ?? [];
  console.log(`[getViewFields] "${viewName}" shows:`, items);
  return items;
}

async function deleteView(listName, viewName) {
  const res = await fetch(_viewEndpoint(listName, viewName), {
    method: 'POST',
    headers: { 'X-RequestDigest': _digest(), 'IF-MATCH': '*', 'X-HTTP-Method': 'DELETE' },
  });
  if (res.ok) console.log(`[deleteView] removed "${viewName}"`);
  else console.warn(`[deleteView] "${viewName}" not removed (${res.status}) -- may not exist`);
  return res.ok;
}

// ---------------------------------------------------------------------------
// All-in-one
// ---------------------------------------------------------------------------

async function runViewTest(listName, opts = {}) {
  if (!listName) { console.error('runViewTest(listName[, {viewName, personal, fields}])'); return; }
  const viewName = opts.viewName || 'SPARC_TestView';
  console.log('%c=== Create-view probe: ' + listName + ' / "' + viewName + '" ===', 'font-weight:bold');
  const verdict = { list: listName, view: viewName };

  console.log('--- 1. reproduce buggy create (no __metadata, expect 400) ---');
  verdict.buggy = await reproduceBuggyCreate(listName);

  console.log('--- 2. fields to show ---');
  const fields = opts.fields || (await getListFields(listName)).map(f => f.InternalName);
  verdict.fields = fields;

  console.log('--- 3. create view (with __metadata) ---');
  try {
    await deleteView(listName, viewName); // start clean if it already exists
    await createView(listName, viewName, { personal: opts.personal ?? false });
    verdict.created = true;
  } catch (e) {
    verdict.created = false; verdict.createError = e.message;
  }

  if (verdict.created) {
    console.log('--- 4. add all fields ---');
    verdict.fill = await addAllFields(listName, viewName, fields);
    console.log('--- 5. read back ---');
    verdict.shows = await getViewFields(listName, viewName);
  }

  const bugConfirmed = verdict.buggy && !verdict.buggy.ok;
  console.log('%c=== VERDICT ===', 'font-weight:bold');
  console.log('buggy create (no __metadata) failed :', bugConfirmed ? `YES (${verdict.buggy.status})` : 'no');
  console.log('correct create (with __metadata) ok :', verdict.created ? 'YES' : 'NO');
  if (verdict.created) {
    console.log('fields shown in view               :', (verdict.shows || []).length);
    const viewUrl = `${_webUrl()}/Lists/${encodeURIComponent(listName)}/${encodeURIComponent(viewName)}.aspx`;
    console.log('Open the view (URL may vary by list path):', viewUrl);
    console.log('Or find it under the list -> view selector. Cleanup: deleteView("' + listName + '","' + viewName + '")');
  }
  if (bugConfirmed && verdict.created) {
    console.log('%cROOT CAUSE CONFIRMED: setup\'s create-view POST is missing __metadata:{type:"SP.View"}. Fix ensureAdminView in views.js.', 'color:green');
  }
  return verdict;
}

// ---------------------------------------------------------------------------
// Expose
// ---------------------------------------------------------------------------

Object.assign(window, {
  runViewTest,
  getListFields,
  reproduceBuggyCreate,
  createView,
  clearViewFields,
  addViewField,
  addAllFields,
  getViewFields,
  deleteView,
});

console.log(
  '[createView.test] loaded. Run: await runViewTest("<listTitle>")\n' +
  'Exposed: runViewTest, getListFields, createView, addAllFields, getViewFields, deleteView'
);
