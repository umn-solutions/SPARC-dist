import { spMERGE, spGET } from '../app/libs/nofbiz/nofbiz.base.js'
import { log } from './log.js'
import { setQuickEdit, setFormsRedirect, ensureAdminView, addFieldToAdminView, setDefaultViewFields, setAdminViewFields, adminViewFieldsFor } from './views.js'

export async function createList(siteApi, listName, schema, appUrl) {
  log('Creating list: ' + listName + '...', 'info');
  try {
    await siteApi.createList(listName);
    log('Created list: ' + listName, 'success');

    const listApi = siteApi.list(listName);
    const createdFields = [];
    for (const sf of schema[listName]) {
      if (sf.builtIn) continue;
      try {
        await listApi.createField(sf);
        log('  + ' + sf.title + (sf.indexed ? ' (indexed)' : '') + (sf.multiline ? ' (Note)' : ''));
        createdFields.push(sf.title);
      } catch (e) {
        console.error('[actions.createList] createField failed', { listName, field: sf.title, err: e });
        log('  ! ' + sf.title + ' -- ' + (e.message || 'failed'), 'error');
      }
    }

    for (const sf of schema[listName]) {
      if (sf.builtIn && sf.indexed) {
        try {
          await listApi.setFieldIndexed(sf.title, true);
          log('  + ' + sf.title + ' (indexed)');
        } catch (e) {
          console.error('[actions.createList] setFieldIndexed failed', { listName, field: sf.title, err: e });
          log('  ! ' + sf.title + ' index -- ' + (e.message || 'failed'), 'error');
        }
      }
    }

    await setQuickEdit(listName, false);
    await setFormsRedirect(listName, true, appUrl);
    await setListHidden(listName, true);

    // Default (AllItems) view: only Modified + Modified By (strips linked Title).
    await setDefaultViewFields(listName);
    // Admin view (personal): all schema fields + native Modified / Modified By.
    await setAdminViewFields(listName, adminViewFieldsFor(schema[listName]));
  } catch (e) {
    console.error('[actions.createList]', { listName, err: e });
    log('Failed to create list ' + listName + ': ' + e.message, 'error');
  }
}

export async function setListHidden(listName, hidden) {
  const label = hidden ? 'Hiding' : 'Showing';
  log(`${label} list: ${listName}...`, 'info');
  try {
    const url = `${_spPageContextInfo.webAbsoluteUrl}/_api/web/lists/getbytitle('${listName}')`;
    await spMERGE(url, {
      headers: { 'IF-MATCH': '*' },
      data: { __metadata: { type: 'SP.List' }, Hidden: hidden },
    });
    log(`${hidden ? 'Hidden' : 'Visible'}: ${listName}`, 'success');
  } catch (e) {
    console.error('[actions.setListHidden]', { listName, hidden, err: e });
    log(`Failed to ${hidden ? 'hide' : 'show'} ${listName}: ${e.message}`, 'error');
  }
}

export async function deleteList(siteApi, listName) {
  log('Deleting list: ' + listName + '...', 'info');
  try {
    await siteApi.deleteList(listName);
    log('Deleted list: ' + listName, 'success');
  } catch (e) {
    console.error('[actions.deleteList]', { listName, err: e });
    log('Failed to delete list ' + listName + ': ' + e.message, 'error');
  }
}

export async function createField(siteApi, listName, fieldName, schema) {
  const sf = schema[listName].find(f => f.title === fieldName);
  if (!sf) { log('Field ' + fieldName + ' not found in schema', 'error'); return; }
  if (sf.builtIn) {
    if (sf.indexed) await fixIndex(siteApi, listName, fieldName, schema);
    return;
  }
  const listApi = siteApi.list(listName);
  log('Creating field: ' + listName + '.' + fieldName + '...', 'info');
  try {
    await listApi.createField(sf);
    log('Created field: ' + listName + '.' + fieldName, 'success');
    await ensureAdminView(listName);
    await addFieldToAdminView(listName, fieldName);
  } catch (e) {
    console.error('[actions.createField]', { listName, fieldName, err: e });
    log('Failed to create field ' + fieldName + ': ' + e.message, 'error');
  }
}

export async function deleteField(siteApi, listName, fieldName) {
  const listApi = siteApi.list(listName);
  log('Deleting field: ' + listName + '.' + fieldName + '...', 'info');
  try {
    await listApi.deleteField(fieldName);
    log('Deleted field: ' + listName + '.' + fieldName, 'success');
  } catch (e) {
    console.error('[actions.deleteField]', { listName, fieldName, err: e });
    log('Failed to delete field ' + fieldName + ': ' + e.message, 'error');
  }
}

export async function fixIndex(siteApi, listName, fieldName, schema) {
  const sf = schema[listName].find(f => f.title === fieldName);
  if (!sf) { log('Field ' + fieldName + ' not found in schema', 'error'); return; }
  const listApi = siteApi.list(listName);
  const targetIndexed = sf.indexed || false;
  log('Setting ' + listName + '.' + fieldName + ' indexed=' + targetIndexed + '...', 'info');
  try {
    await listApi.setFieldIndexed(fieldName, targetIndexed);
    log('Fixed index: ' + listName + '.' + fieldName, 'success');
  } catch (e) {
    console.error('[actions.fixIndex]', { listName, fieldName, err: e });
    log('Failed to fix index ' + fieldName + ': ' + e.message, 'error');
  }
}

export async function syncList(siteApi, listName, scanResult, schema) {
  const result = scanResult[listName];
  if (!result || !result.exists) return;
  log('Syncing fields for ' + listName + '...', 'info');
  for (const d of result.diff) {
    if (d.status === 'MISSING') await createField(siteApi, listName, d.field, schema);
    if (d.status === 'INDEX') await fixIndex(siteApi, listName, d.field, schema);
  }
  log('Sync complete for ' + listName, 'success');
}

export async function fullSetup(siteApi, scanResult, schema, appUrl) {
  log('--- Full Setup ---', 'info');
  for (const listName of Object.keys(schema)) {
    const result = scanResult[listName];
    if (!result.exists) {
      await createList(siteApi, listName, schema, appUrl);
    } else {
      for (const d of result.diff) {
        if (d.status === 'MISSING') await createField(siteApi, listName, d.field, schema);
        if (d.status === 'INDEX') await fixIndex(siteApi, listName, d.field, schema);
      }
      await setQuickEdit(listName, false);
      await setFormsRedirect(listName, true, appUrl);
      await setListHidden(listName, true);
      await setDefaultViewFields(listName);
      await setAdminViewFields(listName, adminViewFieldsFor(schema[listName]));
    }
  }
  log('Full setup complete. Re-scanning...', 'success');
}

export async function syncAll(siteApi, scanResult, schema) {
  log('--- Sync All ---', 'info');
  for (const listName of Object.keys(schema)) {
    const result = scanResult[listName];
    if (!result || !result.exists) continue;
    await syncList(siteApi, listName, scanResult, schema);
  }
  log('Sync all complete. Re-scanning...', 'success');
}

// -- SiteAssets library visibility -------------------------------------------
// Target the library by server-relative URL (getList) rather than title, since
// the display title ("Site Assets") is localized. Hidden only removes it from
// Site Contents -- app files under /SiteAssets/ are still served either way.

function siteAssetsListUrl() {
  const webPath = new URL(_spPageContextInfo.webAbsoluteUrl).pathname.replace(/\/$/, '');
  return `${webPath}/SiteAssets`;
}

export async function getSiteAssetsHidden() {
  try {
    const url = `${_spPageContextInfo.webAbsoluteUrl}/_api/web/getList('${siteAssetsListUrl()}')?$select=Hidden`;
    const res = await spGET(url);
    return (res?.Hidden ?? res?.d?.Hidden ?? false) === true;
  } catch (e) {
    console.warn('[actions.getSiteAssetsHidden]', e);
    return false;
  }
}

export async function setSiteAssetsHidden(hidden) {
  log(`${hidden ? 'Hiding' : 'Showing'} SiteAssets library...`, 'info');
  try {
    const url = `${_spPageContextInfo.webAbsoluteUrl}/_api/web/getList('${siteAssetsListUrl()}')`;
    await spMERGE(url, {
      headers: { 'IF-MATCH': '*' },
      data: { __metadata: { type: 'SP.List' }, Hidden: hidden },
    });
    log(`SiteAssets ${hidden ? 'hidden' : 'visible'}`, 'success');
  } catch (e) {
    console.error('[actions.setSiteAssetsHidden]', { hidden, err: e });
    log(`Failed to ${hidden ? 'hide' : 'show'} SiteAssets: ${e.message}`, 'error');
  }
}
