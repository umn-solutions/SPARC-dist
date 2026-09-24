import * as hucre from 'hucre';
export { hucre };

interface ParseOptions {
    /** Auto-detect delimiter (default: true). When false, uses comma. */
    detectDelimiter?: boolean;
    /** Convert numeric/boolean strings to native types (default: false) */
    typeInference?: boolean;
    /** Skip empty lines (default: true) */
    skipEmptyLines?: boolean;
}
interface XLSXParseOptions {
    /** Sheet name to read (default: first sheet) */
    sheet?: string;
    /** Row number containing headers, 1-based (default: 1) */
    headerRow?: number;
}
interface ParseResult<T> {
    data: T[];
    headers: string[];
}
/**
 * Parse a CSV string into typed objects (synchronous).
 */
declare function parseCSV<T = Record<string, unknown>>(content: string, options?: ParseOptions): ParseResult<T>;
/**
 * Parse a CSV string into a raw 2D array (no header mapping).
 * Useful for preview or inspection.
 */
declare function parseCSVRaw(content: string, options?: Pick<ParseOptions, 'typeInference' | 'skipEmptyLines'>): unknown[][];
/**
 * Parse an XLSX ArrayBuffer into typed objects (async -- uses CompressionStream).
 */
declare function parseXLSX<T = Record<string, unknown>>(buffer: ArrayBuffer, options?: XLSXParseOptions): Promise<ParseResult<T>>;
/**
 * Auto-detect format from input type and parse.
 * - `string` input -> CSV (synchronous, returns `ParseResult<T>`)
 * - `ArrayBuffer` / `Uint8Array` input -> XLSX (async, returns `Promise<ParseResult<T>>`)
 */
declare function parseFile<T = Record<string, unknown>>(input: string | ArrayBuffer | Uint8Array, options?: ParseOptions & XLSXParseOptions): ParseResult<T> | Promise<ParseResult<T>>;
/**
 * Fetch a URL and auto-detect format from Content-Type or file extension.
 */
declare function fetchAndParse<T = Record<string, unknown>>(url: string, options?: ParseOptions & XLSXParseOptions): Promise<ParseResult<T>>;

interface CSVSerializeOptions {
    /** Field delimiter (default: ',') */
    delimiter?: string;
    /** Prepend UTF-8 BOM for Excel compatibility (default: false) */
    bom?: boolean;
    /** Quote style: 'all' quotes every field, 'minimal' quotes only when needed (default: 'minimal') */
    quote?: 'all' | 'minimal';
}
interface XLSXSerializeOptions {
    /** Sheet name (default: 'Sheet1') */
    sheetName?: string;
    /** Column widths by header key (Excel character units) */
    columnWidths?: Record<string, number>;
}
/**
 * Serialize an array of objects to a CSV string.
 */
declare function dataToCSV(data: Record<string, unknown>[], options?: CSVSerializeOptions): string;
/**
 * Serialize an array of objects to an XLSX ArrayBuffer (async).
 */
declare function dataToXLSX(data: Record<string, unknown>[], options?: XLSXSerializeOptions): Promise<ArrayBuffer>;

interface DownloadOptions {
    /** Override auto-detected MIME type */
    mimeType?: string;
}
/**
 * Format-agnostic browser file download.
 * Accepts string (CSV, JSON, etc.) or ArrayBuffer/Uint8Array (XLSX).
 *
 * Uses feature detection to pick the best available download method,
 * with each tier wrapped in its own try/catch so a failure falls through
 * to the next strategy instead of silently swallowing the error.
 *
 * 4-tier fallback:
 * 1. navigator.msSaveBlob (Edge Legacy / IE11 -- no-op on modern browsers)
 * 2. Blob URL with `<a download>` and delayed revocation
 * 3. FileReader data URL with `<a download>`
 * 4. window.open with data URL (last resort, string content only)
 */
declare function downloadFile(content: string | ArrayBuffer | Uint8Array, filename: string, options?: DownloadOptions): void;

interface FileDialogOptions {
    /** File input accept attribute (default: '.csv,.xlsx') */
    accept?: string;
    /** Options passed to CSV parser */
    csvOptions?: ParseOptions;
    /** Options passed to XLSX parser */
    xlsxOptions?: XLSXParseOptions;
}
interface FileDialogResult<T> {
    file: File;
    data: T[];
    headers: string[];
    format: 'csv' | 'xlsx';
}
/**
 * Opens a file picker dialog, auto-detects format from extension,
 * parses the file, and returns data with metadata.
 */
declare function loadFromFile<T = Record<string, unknown>>(options?: FileDialogOptions): Promise<FileDialogResult<T>>;

export { dataToCSV, dataToXLSX, downloadFile, fetchAndParse, loadFromFile, parseCSV, parseCSVRaw, parseFile, parseXLSX };
export type { CSVSerializeOptions, DownloadOptions, FileDialogOptions, FileDialogResult, ParseOptions, ParseResult, XLSXParseOptions, XLSXSerializeOptions };
