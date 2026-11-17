import { spGET } from '../app/libs/nofbiz/nofbiz.base.js'
import { log } from './log.js'

export function computeDiff(schemaFields, liveFields, builtinFields) {
  const liveMap = new Map();
  for (const f of liveFields) {
    liveMap.set(f.InternalName, f);
  }

  const diff = [];

  for (const sf of schemaFields) {
    const live = liveMap.get(sf.title);
    if (!live) {
      if (sf.builtIn) {
        diff.push({ field: sf.title, status: 'OK', schema: sf, live: null });
      } else {
        diff.push({ field: sf.title, status: 'MISSING', schema: sf, live: null });
      }
    } else {
      const expectedIndexed = sf.indexed || false;
      if (live.Indexed !== expectedIndexed) {
        diff.push({ field: sf.title, status: 'INDEX', schema: sf, live });
      } else {
        diff.push({ field: sf.title, status: 'OK', schema: sf, live });
      }
      liveMap.delete(sf.title);
    }
  }

  for (const [name, f] of liveMap) {
    if (!builtinFields.has(name)) {
      diff.push({ field: name, status: 'EXTRA', schema: null, live: f });
    }
  }

  return diff;
}

export function diffSummary(diff) {
  const counts = { OK: 0, MISSING: 0, EXTRA: 0, INDEX: 0 };
  for (const d of diff) counts[d.status]++;
  const parts = [];
  if (counts.OK) parts.push(counts.OK + ' OK');
  if (counts.MISSING) parts.push(counts.MISSING + ' missing');
  if (counts.EXTRA) parts.push(counts.EXTRA + ' extra');
  if (counts.INDEX) parts.push(counts.INDEX + ' index mismatch');
  return parts.join(' | ');
}

export function siteAggregate(scanResult) {
  const lists = Object.values(scanResult).filter(r => r.exists);
  const count = lists.length;
  return {
    count,
    allHidden: count > 0 && lists.every(r => r.hidden),
    allQuickDisabled: count > 0 && lists.every(r => r.quickEditDisabled),
    allFormsRedirected: count > 0 && lists.every(r => r.formsRedirected),
  };
}

export async function scanSite(siteApi, schema, builtinFields, appUrl) {
  log('Scanning site...', 'info');

  const result = {};
  let siteLists;

  try {
    siteLists = await siteApi.getLists();
  } catch (e) {
    console.error('[scan.scanSite] getLists failed', e);
    log('Failed to fetch site lists: ' + e.message, 'error');
    return null;
  }

  const listTitles = new Set(siteLists.map(l => l.Title));

  for (const listName of Object.keys(schema)) {
    const exists = listTitles.has(listName);
    result[listName] = {
      exists, hidden: false, url: null,
      quickEditDisabled: false, formsRedirected: false,
      fields: [], diff: [],
    };

    if (exists) {
      const liveList = siteLists.find(l => l.Title === listName);
      result[listName].hidden = liveList?.Hidden ?? false;
      result[listName].url = liveList?.ServerRelativeUrl
        || `${_spPageContextInfo.webAbsoluteUrl}/Lists/${encodeURIComponent(listName)}`;
      try {
        const listApi = siteApi.list(listName);
        const liveFields = await listApi.getFields();
        result[listName].fields = liveFields;
        result[listName].diff = computeDiff(schema[listName], liveFields, builtinFields);
        log(listName + ': ' + diffSummary(result[listName].diff));
      } catch (e) {
        console.error('[scan] getFields failed for ' + listName, e);
        log(listName + ': failed to read fields -- ' + e.message, 'error');
      }

      const listBase = `${_spPageContextInfo.webAbsoluteUrl}/_api/web/lists/getbytitle('${listName}')`;
      try {
        const dv = await spGET(`${listBase}/DefaultView?$select=TabularView`);
        result[listName].quickEditDisabled = dv?.TabularView === false;
      } catch (e) {
        console.warn('[scan] DefaultView read failed for ' + listName, e);
      }
      try {
        // Forms redirect is a web-scoped ScriptLink custom action named per
        // list (SPARC_FormRedirect_<listId>). Detect it by presence.
        const listId = String(liveList?.Id ?? '').replace(/[{}]/g, '').toLowerCase();
        const acts = await spGET(`${_spPageContextInfo.webAbsoluteUrl}/_api/web/UserCustomActions?$select=Name`);
        const items = acts?.value ?? acts?.d?.results ?? [];
        result[listName].formsRedirected = !!listId && items.some(a => (a.Name || '') === `SPARC_FormRedirect_${listId}`);
      } catch (e) {
        console.warn('[scan] form-redirect action read failed for ' + listName, e);
      }
    } else {
      result[listName].diff = schema[listName].map(sf => ({
        field: sf.title, status: sf.builtIn ? 'OK' : 'MISSING', schema: sf, live: null,
      }));
      log(listName + ': list does not exist', 'info');
    }
  }

  log('Scan complete.', 'success');

  const hasMissingLists = Object.values(result).some(r => !r.exists);
  const hasMissingFields = Object.values(result).some(r =>
    r.diff.some(d => d.status === 'MISSING')
  );
  const hasIndexIssues = Object.values(result).some(r =>
    r.diff.some(d => d.status === 'INDEX')
  );

  return { scanResult: result, hasMissingLists, hasMissingFields, hasIndexIssues };
}
