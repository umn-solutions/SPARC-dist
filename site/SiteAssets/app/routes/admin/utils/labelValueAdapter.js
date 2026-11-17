import { SystemError } from '../../../libs/nofbiz/nofbiz.base.js';

/**
 * Build an index of every entry in the XLSX ZIP container.
 * One pass over the central directory; extraction is lazy + on demand.
 * @param {ArrayBuffer} buffer
 * @returns {{ has(name: string): boolean, extract(name: string): Promise<string> }}
 */
function openZip(buffer) {
  const view = new DataView(buffer);
  const len = view.byteLength;
  const minOffset = Math.max(0, len - 65557);
  let eocd = -1;
  for (let i = len - 22; i >= minOffset; i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) {
    throw new SystemError(
      'XlsxNotZip',
      'Not a valid XLSX file (no ZIP central directory).',
      { breaksFlow: false },
    );
  }
  const cdCount = view.getUint16(eocd + 10, true);
  let cdOffset = view.getUint32(eocd + 16, true);

  const td = new TextDecoder('utf-8');
  const index = new Map();
  for (let i = 0; i < cdCount; i++) {
    if (view.getUint32(cdOffset, true) !== 0x02014b50) {
      throw new SystemError('XlsxCorrupt', 'Malformed ZIP central directory.', { breaksFlow: false });
    }
    const method = view.getUint16(cdOffset + 10, true);
    const compSize = view.getUint32(cdOffset + 20, true);
    const nameLen = view.getUint16(cdOffset + 28, true);
    const extraLen = view.getUint16(cdOffset + 30, true);
    const commentLen = view.getUint16(cdOffset + 32, true);
    const localOff = view.getUint32(cdOffset + 42, true);
    const name = td.decode(new Uint8Array(buffer, cdOffset + 46, nameLen));
    index.set(name, { method, compSize, localOff });
    cdOffset += 46 + nameLen + extraLen + commentLen;
  }

  const cache = new Map();
  return {
    has(name) { return index.has(name); },
    async extract(name) {
      if (cache.has(name)) return cache.get(name);
      const entry = index.get(name);
      if (!entry) {
        throw new SystemError('XlsxFileMissing', `Entry "${name}" not found in XLSX.`, { breaksFlow: false });
      }
      const lhNameLen = view.getUint16(entry.localOff + 26, true);
      const lhExtraLen = view.getUint16(entry.localOff + 28, true);
      const dataStart = entry.localOff + 30 + lhNameLen + lhExtraLen;
      const compData = new Uint8Array(buffer, dataStart, entry.compSize);
      let bytes;
      if (entry.method === 0) {
        bytes = compData;
      } else if (entry.method === 8) {
        const ds = new DecompressionStream('deflate-raw');
        const stream = new Blob([compData]).stream().pipeThrough(ds);
        bytes = new Uint8Array(await new Response(stream).arrayBuffer());
      } else {
        throw new SystemError(
          'XlsxBadCompression',
          `Unsupported ZIP compression method ${entry.method}.`,
          { breaksFlow: false },
        );
      }
      const text = td.decode(bytes);
      cache.set(name, text);
      return text;
    },
  };
}

/**
 * Parse xl/sharedStrings.xml into an indexed array.
 * Each <si> may be plain `<t>` or rich `<r><t>...</t></r>` segments; we concatenate all <t>.
 * @param {string} xml
 * @returns {string[]}
 */
function parseSharedStrings(xml) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  return Array.from(doc.getElementsByTagName('si')).map((si) => {
    const tEls = si.getElementsByTagName('t');
    let s = '';
    for (const t of tEls) s += t.textContent;
    return s;
  });
}

/**
 * Extract the typed value of one <c> cell element.
 * @param {Element} c
 * @param {string[]} sharedStrings
 * @returns {unknown}
 */
function readCellValue(c, sharedStrings) {
  const t = c.getAttribute('t');
  if (t === 's') {
    const v = c.getElementsByTagName('v')[0];
    if (!v) return null;
    const idx = Number(v.textContent);
    return sharedStrings[idx] ?? '';
  }
  if (t === 'inlineStr') {
    const isEl = c.getElementsByTagName('is')[0];
    if (!isEl) return null;
    const tEls = isEl.getElementsByTagName('t');
    return Array.from(tEls).map((tt) => tt.textContent).join('');
  }
  if (t === 'b') {
    const v = c.getElementsByTagName('v')[0];
    return v ? v.textContent === '1' : null;
  }
  // number, date (Excel serial), formula result, etc.
  const v = c.getElementsByTagName('v')[0];
  if (!v) return null;
  const num = Number(v.textContent);
  return Number.isFinite(num) ? num : v.textContent;
}

/**
 * Locate the file path of a sheet by name via xl/_rels/workbook.xml.rels
 * with fallback to the simple "sheet{N}.xml" convention by document order.
 * @returns {string} relative path inside the ZIP (e.g. 'xl/worksheets/sheet1.xml')
 */
function resolveSheetPath(zip, workbookDoc, sheetName) {
  const sheets = Array.from(workbookDoc.getElementsByTagName('sheet'));
  const idx = sheets.findIndex((s) => s.getAttribute('name') === sheetName);
  if (idx < 0) {
    throw new SystemError('SheetNotFound', `Sheet "${sheetName}" not found in workbook.`, { breaksFlow: false });
  }
  return `xl/worksheets/sheet${idx + 1}.xml`;
}

/**
 * Enumerate sheet names from the workbook by parsing xl/workbook.xml directly.
 * @param {ArrayBuffer} buffer
 * @returns {Promise<string[]>}
 */
export async function discoverSheetNames(buffer) {
  const zip = openZip(buffer);
  const xml = await zip.extract('xl/workbook.xml');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const sheets = Array.from(doc.getElementsByTagName('sheet'));
  return sheets.map((s) => s.getAttribute('name')).filter(Boolean);
}

/**
 * Read every cell in a single column of a sheet, keyed by A1 cell address.
 * Direct XLSX read: no synthetic header row needed; works for any template layout.
 * @param {ArrayBuffer} buffer
 * @param {string} sheetName
 * @param {string} columnLetter e.g. 'C'
 * @returns {Promise<Map<string, unknown>>} keys: 'C9', 'C10', ...
 */
export async function readColumn(buffer, sheetName, columnLetter) {
  const zip = openZip(buffer);
  const wbXml = await zip.extract('xl/workbook.xml');
  const wbDoc = new DOMParser().parseFromString(wbXml, 'application/xml');
  const sheetPath = resolveSheetPath(zip, wbDoc, sheetName);

  const sharedStrings = zip.has('xl/sharedStrings.xml')
    ? parseSharedStrings(await zip.extract('xl/sharedStrings.xml'))
    : [];

  const sheetXml = await zip.extract(sheetPath);
  const sheetDoc = new DOMParser().parseFromString(sheetXml, 'application/xml');

  const targetCol = columnLetter.toUpperCase();
  const map = new Map();
  for (const c of Array.from(sheetDoc.getElementsByTagName('c'))) {
    const ref = c.getAttribute('r');
    if (!ref) continue;
    const m = ref.match(/^([A-Z]+)(\d+)$/);
    if (!m || m[1] !== targetCol) continue;
    map.set(ref, readCellValue(c, sharedStrings));
  }
  return map;
}
