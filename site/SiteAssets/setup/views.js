import { spGET, spMERGE, spPOST, spDELETE } from '../app/libs/nofbiz/nofbiz.base.js'
import { log } from './log.js'

const REDIRECT_ACTION_PREFIX = 'SPARC_FormRedirect';

// Empty-body POST actions (addviewfield / removeallviewfields) must NOT carry
// spPOST's default odata=verbose Content-Type -- SharePoint tries to parse the
// empty body as verbose OData and returns 400. Force nometadata for these.
const ACTION_POST = { headers: { 'Accept': 'application/json;odata=nometadata', 'Content-Type': 'application/json;odata=nometadata' } };

// Read a list's GUID (lowercased, braces stripped) for the redirect guard.
async function getListId(listName) {
  const res = await spGET(`${_spPageContextInfo.webAbsoluteUrl}/_api/web/lists/getbytitle('${listName}')?$select=Id`);
  const id = String(res?.Id ?? res?.d?.Id ?? '').replace(/[{}]/g, '').toLowerCase();
  if (!id) throw new Error('could not read list Id');
  return id;
}

// Guarded redirect injected via a web-scoped ScriptLink custom action: fires
// only on the target list's New/Edit form pages, sends the user to the app.
function redirectScriptBlock(listId, appUrl) {
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

export async function setQuickEdit(listName, enabled) {
  const url = `${_spPageContextInfo.webAbsoluteUrl}/_api/web/lists/getbytitle('${listName}')/DefaultView`;
  try {
    await spMERGE(url, {
      headers: { 'IF-MATCH': '*' },
      data: { __metadata: { type: 'SP.View' }, TabularView: enabled },
    });
    log(`  [view] Quick edit ${enabled ? 'enabled' : 'disabled'} on ${listName}`);
  } catch (e) {
    console.error('[views.setQuickEdit]', { listName, enabled, err: e });
    log(`  [view] ! Failed to ${enabled ? 'enable' : 'disable'} quick edit -- ` + (e.message || 'failed'), 'error');
  }
}

// Redirect the list's New/Edit forms to the app via a web-scoped ScriptLink
// custom action (pure REST). Chosen over list.DefaultNewFormUrl (read-only via
// REST; only accepts the list's own SPForms) and ContentType.NewFormUrl (JSOM-
// writable but makes SharePoint form-render the app page in list context, which
// 500s once a real List GUID is on the URL). Keeping SharePoint's real forms
// and bouncing off them on load avoids that. The action is named per list and
// removed on restore, so the toggle is idempotent.
export async function setFormsRedirect(listName, redirect, appUrl) {
  const web = _spPageContextInfo.webAbsoluteUrl;
  try {
    const listId = await getListId(listName);
    const actionName = `${REDIRECT_ACTION_PREFIX}_${listId}`;

    // Remove any existing redirect action for this list first (idempotent).
    const existing = await spGET(`${web}/_api/web/UserCustomActions?$select=Id,Name`);
    const items = existing?.value ?? existing?.d?.results ?? [];
    for (const a of items) {
      if ((a.Name || '') === actionName) {
        await spDELETE(`${web}/_api/web/UserCustomActions(guid'${a.Id}')`, { headers: { 'IF-MATCH': '*' } });
      }
    }

    if (redirect) {
      await spPOST(`${web}/_api/web/UserCustomActions`, {
        data: {
          __metadata: { type: 'SP.UserCustomAction' },
          Title: REDIRECT_ACTION_PREFIX,
          Name: actionName,
          Location: 'ScriptLink',
          ScriptBlock: redirectScriptBlock(listId, appUrl),
          Sequence: 100,
        },
      });
    }
    log(`  [forms] ${redirect ? 'Redirected New/Edit forms to app (ScriptLink)' : 'Removed form redirect'} on ${listName}`);
  } catch (e) {
    console.error('[views.setFormsRedirect]', { listName, redirect, err: e });
    log(`  [forms] ! Failed to ${redirect ? 'redirect' : 'restore'} forms -- ` + (e.message || 'failed'), 'error');
  }
}

export async function ensureAdminView(listName) {
  const base = `${_spPageContextInfo.webAbsoluteUrl}/_api/web/lists/getbytitle('${listName}')`;
  // SharePoint returns 404 OR 400 ("the specified view is invalid") when the
  // view doesn't exist -- treat any existence-check failure as "not found",
  // rather than branching on an inconsistent status code.
  try {
    await spGET(`${base}/views/getbytitle('Admin')`);
    return; // already exists
  } catch (e) {
    console.warn('[views.ensureAdminView] Admin view not found, creating', { listName, status: e?.status });
  }
  // PersonalView: true -> the Admin view is visible ONLY to the user who runs
  // this (each admin who triggers setup gets their own private Admin view).
  await spPOST(`${base}/views`, {
    data: { __metadata: { type: 'SP.View' }, Title: 'Admin', PersonalView: true, TabularView: true },
  });
  log('  [view] Created personal Admin view');
}

export async function addFieldToAdminView(listName, fieldName) {
  const url = `${_spPageContextInfo.webAbsoluteUrl}/_api/web/lists/getbytitle('${listName}')/views/getbytitle('Admin')/ViewFields/addviewfield('${fieldName}')`;
  try {
    await spPOST(url, ACTION_POST);
    log('  [view] + ' + fieldName);
  } catch (e) {
    console.error('[views.addFieldToAdminView]', { listName, fieldName, err: e });
    log('  [view] ! ' + fieldName + ' -- ' + (e.message || 'failed'), 'error');
  }
}

// -- View field composition --------------------------------------------------
// Native audit fields shown in views: Modified + Modified By (Editor).
const NATIVE_MODIFIED_FIELDS = ['Modified', 'Editor'];

// Admin view = all schema field internal names + the native Modified/Modified By.
export function adminViewFieldsFor(schemaFields) {
  const names = (schemaFields || []).map(f => f.title);
  for (const n of NATIVE_MODIFIED_FIELDS) if (!names.includes(n)) names.push(n);
  return names;
}

// Clear a view's fields then set them to exactly `fieldNames` (in order).
// viewPath is the REST segment after the list: 'DefaultView' or
// "views/getbytitle('Admin')". Per-field failures are logged, not fatal.
async function setViewFields(listName, viewPath, fieldNames) {
  const base = `${_spPageContextInfo.webAbsoluteUrl}/_api/web/lists/getbytitle('${listName}')/${viewPath}/viewfields`;
  await spPOST(`${base}/removeallviewfields`, ACTION_POST);
  for (const f of fieldNames) {
    try {
      await spPOST(`${base}/addviewfield('${f}')`, ACTION_POST);
      log('  [view] + ' + f);
    } catch (e) {
      console.error('[views.setViewFields]', { listName, viewPath, field: f, err: e });
      log('  [view] ! ' + f + ' -- ' + (e.message || 'failed'), 'error');
    }
  }
}

// Default (AllItems) view -> only the given fields (default: Modified + Modified By).
// Removing all fields first drops the linked Title (LinkTitle) column.
export async function setDefaultViewFields(listName, fields = NATIVE_MODIFIED_FIELDS) {
  log(`  [view] Setting default view fields on ${listName}...`, 'info');
  try {
    await setViewFields(listName, 'DefaultView', fields);
    log(`  [view] Default view -> ${fields.join(', ')}`, 'success');
  } catch (e) {
    console.error('[views.setDefaultViewFields]', { listName, err: e });
    log('  [view] ! default view fields -- ' + (e.message || 'failed'), 'error');
  }
}

// Personal Admin view -> the given fields (schema + native). Creates it if absent.
export async function setAdminViewFields(listName, fieldNames) {
  log(`  [view] Populating Admin view on ${listName}...`, 'info');
  try {
    await ensureAdminView(listName);
    await setViewFields(listName, "views/getbytitle('Admin')", fieldNames);
    log(`  [view] Admin view -> ${fieldNames.length} fields`, 'success');
  } catch (e) {
    console.error('[views.setAdminViewFields]', { listName, err: e });
    log('  [view] ! admin view fields -- ' + (e.message || 'failed'), 'error');
  }
}
