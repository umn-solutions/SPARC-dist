import { SiteApi } from '../app/libs/nofbiz/nofbiz.base.js'
import { SCHEMA, BUILTIN_FIELDS, APP_URL } from './schema.js'
import { initLog, log } from './log.js'
import { scanSite, siteAggregate } from './scan.js'
import { renderCards, setBusy, setButtonBusy, renderSiteControls } from './render.js'
import {
  createList, deleteList, setListHidden,
  createField, deleteField, fixIndex,
  syncList, fullSetup, syncAll,
  getSiteAssetsHidden, setSiteAssetsHidden,
} from './actions.js'
import { setQuickEdit, setFormsRedirect, setDefaultViewFields, setAdminViewFields, adminViewFieldsFor } from './views.js'
import { exportSiteBackup, exportListBackup, exportListCSV, exportListXLSX } from './backup.js'
import { readBackupFile, restoreSite, restoreList } from './restore.js'

// -- State -------------------------------------------------------------------
const siteApi = new SiteApi();
let scanResult = null;
let busy = false;

// -- DOM refs ----------------------------------------------------------------
const cardsEl = document.getElementById('list-cards');
const siteControlsEl = document.getElementById('site-controls');
const logEl = document.getElementById('log');
const scanTimeEl = document.getElementById('scan-time');
const btnScan = document.getElementById('btn-scan');
const btnFullSetup = document.getElementById('btn-full-setup');
const btnSyncAll = document.getElementById('btn-sync-all');
const btnGenData = document.getElementById('btn-gen-data');
const genCountSelect = document.getElementById('gen-count');
const btnBackupSite = document.getElementById('btn-backup-site');
const btnRestoreSite = document.getElementById('btn-restore-site');
const fileRestoreInput = document.getElementById('file-restore');
const btnToggleSiteAssets = document.getElementById('btn-toggle-siteassets');

initLog(logEl);

// -- Optional data generation ------------------------------------------------
// generate.js is optional. If the file is absent or exports no generateData
// function, hide the generation inputs entirely.
let generateData = null;
try {
  ({ generateData } = await import('./generate.js'));
} catch (e) {
  console.warn('[setup] generate.js unavailable -- generation disabled', e);
}
const genEnabled = typeof generateData === 'function';
if (!genEnabled) {
  genCountSelect.previousElementSibling?.remove(); // adjacent separator
  genCountSelect.remove();
  btnGenData.remove();
}

// -- Scan orchestration ------------------------------------------------------
async function doScan() {
  if (busy) return;
  busy = true;
  setBusy(true, btnScan);
  logEl.textContent = '';

  const result = await scanSite(siteApi, SCHEMA, BUILTIN_FIELDS, APP_URL);

  if (!result) {
    busy = false;
    setBusy(false, btnScan);
    return;
  }

  scanResult = result.scanResult;
  scanTimeEl.textContent = 'Last scan: ' + new Date().toLocaleTimeString();
  renderCards(scanResult, cardsEl);
  renderSiteControls(scanResult, siteControlsEl);

  btnFullSetup.disabled = !(result.hasMissingLists || result.hasMissingFields || result.hasIndexIssues);
  btnSyncAll.disabled = !(result.hasMissingFields || result.hasIndexIssues);

  const anyListExists = Object.values(result.scanResult).some(r => r.exists);
  btnBackupSite.disabled = !anyListExists;

  if (btnToggleSiteAssets) {
    const saHidden = await getSiteAssetsHidden();
    btnToggleSiteAssets.disabled = false;
    btnToggleSiteAssets.dataset.hidden = String(saHidden);
    btnToggleSiteAssets.textContent = saHidden ? 'Show SiteAssets' : 'Hide SiteAssets';
  }

  if (genEnabled) {
    const tasksExists = result.scanResult.Tasks?.exists ?? false;
    btnGenData.disabled = !tasksExists;
    genCountSelect.disabled = !tasksExists;
  }

  busy = false;
  setBusy(false, btnScan);
}

// -- Full setup orchestration ------------------------------------------------
async function doFullSetup() {
  if (busy) return;
  busy = true;
  setBusy(true, btnScan);

  await fullSetup(siteApi, scanResult, SCHEMA, APP_URL);

  busy = false;
  await doScan();
}

// -- Sync all orchestration --------------------------------------------------
async function doSyncAll() {
  if (busy) return;
  busy = true;
  setBusy(true, btnScan);

  await syncAll(siteApi, scanResult, SCHEMA);

  busy = false;
  await doScan();
}

// -- Generate data orchestration ---------------------------------------------
async function doGenerateData() {
  if (busy) return;
  busy = true;
  setBusy(true, btnScan);
  try {
    await generateData(siteApi, parseInt(genCountSelect.value, 10));
  } catch (e) {
    console.error('[index.doGenerateData]', e);
    log('Data generation failed: ' + (e.message || 'unknown error'), 'error');
  } finally {
    busy = false;
    setBusy(false, btnScan);
  }
}

// -- Event delegation --------------------------------------------------------
cardsEl.addEventListener('click', async (e) => {
  const header = e.target.closest('.card-header');
  if (header && !e.target.closest('button, a')) {
    header.closest('.list-card').classList.toggle('open');
    return;
  }

  const btn = e.target.closest('button[data-action]');
  if (!btn || busy) return;

  const action = btn.dataset.action;
  const listName = btn.dataset.list;
  const fieldName = btn.dataset.field;

  if (action === 'delete-list') {
    if (!window.confirm('Delete list "' + listName + '" and all its data?')) return;
  }
  if (action === 'delete-field') {
    if (!window.confirm('Delete field "' + fieldName + '" from "' + listName + '"?')) return;
  }

  busy = true;
  setButtonBusy(btn, '...');

  if (action === 'create-list') await createList(siteApi, listName, SCHEMA, APP_URL);
  else if (action === 'delete-list') await deleteList(siteApi, listName);
  else if (action === 'create-field') await createField(siteApi, listName, fieldName, SCHEMA);
  else if (action === 'delete-field') await deleteField(siteApi, listName, fieldName);
  else if (action === 'fix-index') await fixIndex(siteApi, listName, fieldName, SCHEMA);
  else if (action === 'sync-list') await syncList(siteApi, listName, scanResult, SCHEMA);
  else if (action === 'toggle-hidden') await setListHidden(listName, !scanResult[listName]?.hidden);
  else if (action === 'toggle-quickedit') await setQuickEdit(listName, !!scanResult[listName]?.quickEditDisabled);
  else if (action === 'toggle-forms') await setFormsRedirect(listName, !scanResult[listName]?.formsRedirected, APP_URL);
  else if (action === 'setup-views') {
    await setDefaultViewFields(listName);
    await setAdminViewFields(listName, adminViewFieldsFor(SCHEMA[listName]));
  }
  else if (action === 'export-backup') {
    await exportListBackup(siteApi, listName, scanResult, APP_URL);
    busy = false;
    btn.textContent = btn.dataset.origLabel || 'Export .txt';
    btn.disabled = false;
    return;
  }
  else if (action === 'export-csv') {
    await exportListCSV(siteApi, listName, scanResult);
    busy = false;
    btn.textContent = btn.dataset.origLabel || 'Export CSV';
    btn.disabled = false;
    return;
  }
  else if (action === 'export-xlsx') {
    await exportListXLSX(siteApi, listName, scanResult);
    busy = false;
    btn.textContent = btn.dataset.origLabel || 'Export XLSX';
    btn.disabled = false;
    return;
  }
  else if (action === 'import-list') {
    // Trigger the per-list hidden file input co-rendered with this card
    const card = btn.closest('.list-card');
    const fileInput = card ? card.querySelector(`.file-import-list[data-list="${listName}"]`) : null;
    if (fileInput) {
      busy = false;
      btn.disabled = false;
      btn.textContent = btn.dataset.origLabel || 'Import';
      fileInput.value = '';
      fileInput.click();
    } else {
      log('Import file input not found for ' + listName, 'error');
      busy = false;
      btn.disabled = false;
    }
    return;
  }

  busy = false;
  await doScan();
});

// -- Per-list file input (import) --------------------------------------------
// Delegate to cardsEl since file inputs are dynamically rendered
cardsEl.addEventListener('change', async (e) => {
  const fileInput = e.target.closest('.file-import-list');
  if (!fileInput) return;
  const listName = fileInput.dataset.list;
  const file = fileInput.files[0];
  if (!file || !listName) return;

  if (busy) { fileInput.value = ''; return; }

  // Ensure live state before restoring. Run the scan BEFORE taking the busy
  // lock -- doScan() no-ops while busy is true, which would leave scanResult null.
  if (!scanResult) await doScan();
  if (!scanResult) { fileInput.value = ''; return; }

  busy = true;
  setBusy(true, btnScan);

  log(`--- Import List: ${listName} ---`, 'info');
  let backup;
  try {
    backup = await readBackupFile(file);
  } catch (err) {
    console.error('[index] readBackupFile failed', { listName, err });
    log('Import failed: ' + err.message, 'error');
    fileInput.value = '';
    busy = false;
    setBusy(false, btnScan);
    return;
  }

  await restoreList(siteApi, backup, listName, scanResult, APP_URL);
  fileInput.value = '';
  busy = false;
  await doScan();
});

// -- Site-wide controls ------------------------------------------------------
async function applyToAllLists(fn) {
  for (const listName of Object.keys(SCHEMA)) {
    if (scanResult?.[listName]?.exists) await fn(listName);
  }
}

siteControlsEl.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-site-action]');
  if (!btn || busy) return;

  busy = true;
  setButtonBusy(btn, '...');

  const agg = siteAggregate(scanResult);
  const siteAction = btn.dataset.siteAction;

  if (siteAction === 'hidden') {
    const hide = !agg.allHidden;
    log(`--- Site-wide: ${hide ? 'Hide' : 'Show'} all lists ---`, 'info');
    await applyToAllLists(n => setListHidden(n, hide));
  } else if (siteAction === 'quickedit') {
    const enable = agg.allQuickDisabled; // all disabled -> enable, else disable
    log(`--- Site-wide: ${enable ? 'Enable' : 'Disable'} quick edit on all lists ---`, 'info');
    await applyToAllLists(n => setQuickEdit(n, enable));
  } else if (siteAction === 'forms') {
    const redirect = !agg.allFormsRedirected;
    log(`--- Site-wide: ${redirect ? 'Redirect' : 'Restore'} forms on all lists ---`, 'info');
    await applyToAllLists(n => setFormsRedirect(n, redirect, APP_URL));
  }

  busy = false;
  await doScan();
});

// -- Global buttons ----------------------------------------------------------
btnScan.addEventListener('click', doScan);
btnFullSetup.addEventListener('click', doFullSetup);
btnSyncAll.addEventListener('click', doSyncAll);
if (genEnabled) btnGenData.addEventListener('click', doGenerateData);

// -- Hide/Show SiteAssets library --------------------------------------------
btnToggleSiteAssets?.addEventListener('click', async () => {
  if (busy) return;
  busy = true;
  setButtonBusy(btnToggleSiteAssets, '...');
  const currentlyHidden = btnToggleSiteAssets.dataset.hidden === 'true';
  await setSiteAssetsHidden(!currentlyHidden);
  busy = false;
  await doScan();
});

// -- Backup Site -------------------------------------------------------------
btnBackupSite.addEventListener('click', async () => {
  if (busy) return;
  if (!scanResult) { log('Run a scan first.', 'info'); return; }
  busy = true;
  setButtonBusy(btnBackupSite, '...');
  await exportSiteBackup(siteApi, scanResult, SCHEMA, APP_URL);
  busy = false;
  btnBackupSite.textContent = btnBackupSite.dataset.origLabel || 'Backup Site';
  btnBackupSite.disabled = false;
});

// -- Restore Site (file picker -> parse -> restore -> re-scan) ---------------
btnRestoreSite.addEventListener('click', () => {
  if (busy) return;
  fileRestoreInput.value = '';
  fileRestoreInput.click();
});

fileRestoreInput.addEventListener('change', async () => {
  const file = fileRestoreInput.files[0];
  if (!file) return;
  if (busy) { fileRestoreInput.value = ''; return; }

  // Ensure live state before restoring. Restore can run on a never-scanned
  // site; scan BEFORE taking the busy lock so doScan() doesn't no-op.
  if (!scanResult) await doScan();
  if (!scanResult) { fileRestoreInput.value = ''; return; }

  busy = true;
  setBusy(true, btnScan);

  log('--- Site Restore ---', 'info');
  let backup;
  try {
    backup = await readBackupFile(file);
  } catch (err) {
    console.error('[index] readBackupFile failed (site restore)', err);
    log('Restore failed: ' + err.message, 'error');
    fileRestoreInput.value = '';
    busy = false;
    setBusy(false, btnScan);
    return;
  }

  await restoreSite(siteApi, backup, scanResult, APP_URL);
  fileRestoreInput.value = '';
  busy = false;
  await doScan();
});

// -- Log toggle --------------------------------------------------------------
document.getElementById('log-toggle').addEventListener('click', () => {
  document.getElementById('log-panel').classList.toggle('open');
});
