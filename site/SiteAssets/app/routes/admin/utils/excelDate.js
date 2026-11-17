const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);
const MS_PER_DAY = 86400000;

/**
 * Convert an Excel cell value to an ISO 8601 string.
 * Handles Date instances, Excel serial day numbers, ISO-parseable strings.
 * Passes through values it cannot interpret.
 * @param {unknown} value
 * @returns {unknown}
 */
export function excelSerialToISO(value) {
  if (value === null || value === undefined || value === '') return value;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? value : value.toISOString();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const d = new Date(EXCEL_EPOCH_MS + value * MS_PER_DAY);
    return Number.isNaN(d.getTime()) ? value : d.toISOString();
  }
  if (typeof value === 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toISOString();
  }
  return value;
}
