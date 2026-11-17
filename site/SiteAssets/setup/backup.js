import { downloadFile, dataToCSV, dataToXLSX } from '../app/libs/nofbiz/nofbiz.excelparser.js'
import { BUILTIN_FIELDS } from './schema.js'
import { log } from './log.js'

// -- Field mapping -----------------------------------------------------------

function toSchemaField(spField) {
  const type = spField.TypeAsString || '';
  return {
    title: spField.InternalName,
    indexed: !!spField.Indexed,
    builtIn: BUILTIN_FIELDS.has(spField.InternalName),
    multiline: type === 'Note' || type === 'MultilineText',
  };
}

function toFieldTypes(spFields) {
  const map = {};
  for (const f of spFields) {
    map[f.InternalName] = f.TypeAsString || 'Text';
  }
  return map;
}

// -- Date helpers ------------------------------------------------------------

function isoDate() {
  return new Date().toISOString().slice(0, 10);
}

// -- List backup -------------------------------------------------------------

export async function buildListBackup(siteApi, listName, scanResult) {
  const listResult = scanResult[listName];
  if (!listResult || !listResult.exists) {
    log(`[backup] ${listName}: list does not exist in scan result -- skipping`, 'error');
    return null;
  }

  const config = {
    hidden: listResult.hidden,
    quickEditDisabled: listResult.quickEditDisabled,
    formsRedirected: listResult.formsRedirected,
  };

  const spFields = listResult.fields || [];
  const fields = spFields.map(toSchemaField);
  const fieldTypes = toFieldTypes(spFields);

  log(`[backup] ${listName}: reading items...`, 'info');
  const items = [];
  const listApi = siteApi.list(listName);
  let page = 1;

  try {
    let result = await listApi.getItemsPaged();
    items.push(...result.items);
    log(`[backup] ${listName}: page ${page} -- ${result.items.length} items`, 'info');

    while (result.next) {
      page++;
      result = await result.next();
      items.push(...result.items);
      log(`[backup] ${listName}: page ${page} -- ${result.items.length} items`, 'info');
    }
  } catch (e) {
    console.error('[backup.buildListBackup] getItemsPaged failed', { listName, e });
    log(`[backup] ${listName}: failed to read items -- ${e.message}`, 'error');
    return null;
  }

  log(`[backup] ${listName}: ${items.length} items total`, 'success');
  return { config, fields, fieldTypes, items };
}

// -- Site backup -------------------------------------------------------------

export async function buildSiteBackup(siteApi, scanResult, schema, appUrl) {
  const lists = {};

  for (const listName of Object.keys(schema)) {
    if (!scanResult[listName]?.exists) {
      log(`[backup] Skipping ${listName} (does not exist)`, 'info');
      continue;
    }
    log(`[backup] Backing up list: ${listName}`, 'info');
    const listBackup = await buildListBackup(siteApi, listName, scanResult);
    if (listBackup) lists[listName] = listBackup;
  }

  return {
    sparcBackup: '1.0',
    createdAt: new Date().toISOString(),
    site: {
      webAbsoluteUrl: _spPageContextInfo.webAbsoluteUrl,
      appUrl: appUrl,
    },
    lists,
  };
}

// -- Export helpers ----------------------------------------------------------

function backupFilename(label) {
  const site = _spPageContextInfo.webAbsoluteUrl
    .replace(/^https?:\/\//, '')
    .replace(/[^a-zA-Z0-9-]/g, '_')
    .slice(0, 40);
  return `sparc-backup-${label}-${site}-${isoDate()}.txt`;
}

export async function exportSiteBackup(siteApi, scanResult, schema, appUrl) {
  log('--- Site Backup ---', 'info');
  let backup;
  try {
    backup = await buildSiteBackup(siteApi, scanResult, schema, appUrl);
  } catch (e) {
    console.error('[backup.exportSiteBackup] buildSiteBackup failed', e);
    log('Site backup failed: ' + e.message, 'error');
    return;
  }
  const json = JSON.stringify(backup, null, 2);
  try {
    downloadFile(json, backupFilename('site'));
    log('Site backup downloaded.', 'success');
  } catch (e) {
    console.error('[backup.exportSiteBackup] downloadFile failed', e);
    log('Download failed: ' + e.message, 'error');
  }
}

export async function exportListBackup(siteApi, listName, scanResult, appUrl) {
  log(`--- List Backup: ${listName} ---`, 'info');
  let listBackup;
  try {
    listBackup = await buildListBackup(siteApi, listName, scanResult);
  } catch (e) {
    console.error('[backup.exportListBackup] buildListBackup failed', { listName, e });
    log(`List backup failed for ${listName}: ` + e.message, 'error');
    return;
  }
  if (!listBackup) return;

  const payload = {
    sparcBackup: '1.0',
    createdAt: new Date().toISOString(),
    site: {
      webAbsoluteUrl: _spPageContextInfo.webAbsoluteUrl,
      appUrl: appUrl,
    },
    lists: { [listName]: listBackup },
  };
  const json = JSON.stringify(payload, null, 2);
  try {
    downloadFile(json, backupFilename(listName));
    log(`List backup downloaded: ${listName}`, 'success');
  } catch (e) {
    console.error('[backup.exportListBackup] downloadFile failed', { listName, e });
    log('Download failed: ' + e.message, 'error');
  }
}

// -- CSV / XLSX data-only export (human viewing, not for restore) -------------

export async function exportListCSV(siteApi, listName, scanResult) {
  log(`--- Export CSV: ${listName} ---`, 'info');
  const listBackup = await buildListBackup(siteApi, listName, scanResult);
  if (!listBackup) return;

  if (listBackup.items.length === 0) {
    log(`${listName}: no items to export`, 'info');
    return;
  }

  let csv;
  try {
    csv = dataToCSV(listBackup.items);
  } catch (e) {
    console.error('[backup.exportListCSV] dataToCSV failed', { listName, e });
    log(`CSV conversion failed: ${e.message}`, 'error');
    return;
  }

  const filename = `sparc-data-${listName}-${isoDate()}.csv`;
  try {
    downloadFile(csv, filename);
    log(`CSV downloaded: ${filename}`, 'success');
  } catch (e) {
    console.error('[backup.exportListCSV] downloadFile failed', { listName, e });
    log('Download failed: ' + e.message, 'error');
  }
}

export async function exportListXLSX(siteApi, listName, scanResult) {
  log(`--- Export XLSX: ${listName} ---`, 'info');
  const listBackup = await buildListBackup(siteApi, listName, scanResult);
  if (!listBackup) return;

  if (listBackup.items.length === 0) {
    log(`${listName}: no items to export`, 'info');
    return;
  }

  let buf;
  try {
    buf = await dataToXLSX(listBackup.items);
  } catch (e) {
    console.error('[backup.exportListXLSX] dataToXLSX failed', { listName, e });
    log(`XLSX conversion failed: ${e.message}`, 'error');
    return;
  }

  const filename = `sparc-data-${listName}-${isoDate()}.xlsx`;
  try {
    downloadFile(buf, filename);
    log(`XLSX downloaded: ${filename}`, 'success');
  } catch (e) {
    console.error('[backup.exportListXLSX] downloadFile failed', { listName, e });
    log('Download failed: ' + e.message, 'error');
  }
}
