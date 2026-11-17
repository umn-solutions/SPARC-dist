// ---------------------------------------------------------------------------
// documents.js
//
// SharePoint document library access utilities.
//
// Errors propagate to the caller. The caller is responsible for distinguishing
// an empty folder (resolved []) from a fetch failure (thrown error).
// ---------------------------------------------------------------------------

import { spGET, SystemError } from '../libs/nofbiz/nofbiz.base.js';

// Module-level memoisation: one in-flight Promise per library title.
// A failed promise is evicted so a retry starts fresh.
const _rootCache = new Map();

/**
 * Resolves the server-relative root folder URL for a document library by its display title.
 * Result is memoised per title for the lifetime of the page.
 *
 * @param {string} libraryTitle - The SharePoint display title of the library (e.g. 'Team Documents').
 * @returns {Promise<string>} Server-relative URL, e.g. '/site/Shared Documents'.
 */
function _resolveLibraryRoot(libraryTitle) {
  const cached = _rootCache.get(libraryTitle);
  if (cached) return cached;

  const escaped = libraryTitle.replace(/'/g, "''");
  const base = _spPageContextInfo.webAbsoluteUrl;
  const url = `${base}/_api/web/lists/getbytitle('${escaped}')/RootFolder?$select=ServerRelativeUrl`;

  const promise = spGET(url).then((data) => {
    // Single-entity response: { ServerRelativeUrl: '...' }
    // Guard against unexpected shapes.
    const root = data.ServerRelativeUrl
      ?? data.d?.ServerRelativeUrl
      ?? (data.value && data.value[0]?.ServerRelativeUrl);
    if (!root) {
      throw new SystemError(
        'DocumentsError',
        `ServerRelativeUrl missing in response for library "${libraryTitle}"`,
        { breaksFlow: false },
      );
    }
    return root;
  });

  _rootCache.set(libraryTitle, promise);

  // Evict on failure so a later retry goes to the network.
  promise.catch((err) => {
    console.warn('[documents._resolveLibraryRoot] root resolution failed, evicting cache', { libraryTitle, err });
    _rootCache.delete(libraryTitle);
  });

  return promise;
}

/**
 * Returns the files inside a subfolder of a document library.
 * Files are sorted by Name (ascending). Errors propagate.
 *
 * @param {string} libraryTitle - Display title of the library.
 * @param {string} subPath - Subfolder path relative to the library root (e.g. 'public/homepage/resources').
 * @returns {Promise<Array<{name:string, url:string, ext:string, size:number, modified:string}>>}
 */
export async function listFolderFiles(libraryTitle, subPath) {
  let root;
  try {
    root = await _resolveLibraryRoot(libraryTitle);
  } catch (err) {
    console.error('[documents.listFolderFiles] library root resolution failed', { libraryTitle, err });
    throw err;
  }

  const folderPath = root + '/' + subPath;
  // OData-escape single quotes first, then URL-encode the whole value so '#',
  // '&', and '%' in folder names cannot corrupt the query string.
  // SP URL-decodes the query parameter before interpreting the OData literal.
  const spSafePath = encodeURIComponent(folderPath.replace(/'/g, "''"));

  const base = _spPageContextInfo.webAbsoluteUrl;
  const url =
    `${base}/_api/web/GetFolderByServerRelativeUrl(@p)/Files` +
    `?@p='${spSafePath}'` +
    `&$select=Name,ServerRelativeUrl,TimeLastModified,Length`;

  let data;
  try {
    data = await spGET(url);
  } catch (err) {
    console.error('[documents.listFolderFiles] file listing failed', { libraryTitle, subPath, err });
    throw err;
  }

  const files = data.value ?? (data.d ? data.d.results : []);

  return files
    .map((f) => ({
      name: f.Name,
      url: f.ServerRelativeUrl,
      ext: f.Name.includes('.') ? f.Name.split('.').pop().toLowerCase() : '',
      size: parseInt(f.Length, 10) || 0,
      modified: f.TimeLastModified,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Builds the full server-relative URL to a named file inside a library subfolder.
 * Uses the same library root resolution as listFolderFiles (memoised).
 * Errors propagate.
 *
 * @param {string} libraryTitle - Display title of the library.
 * @param {string} subPath - Subfolder path relative to the library root (may be empty).
 * @param {string} fileName - The file name, URL-encoded via encodeURIComponent.
 * @returns {Promise<string>} Server-relative URL to the file.
 */
export async function buildFileUrl(libraryTitle, subPath, fileName) {
  let root;
  try {
    root = await _resolveLibraryRoot(libraryTitle);
  } catch (err) {
    console.error('[documents.buildFileUrl] library root resolution failed', { libraryTitle, err });
    throw err;
  }

  // SP returns ServerRelativeUrl decoded (e.g. '/site/Shared Documents').
  // Encode every segment so the resulting href/src is a valid URL.
  const encodedRoot = root.split('/').map(encodeURIComponent).join('/');
  const parts = [encodedRoot];
  if (subPath) {
    parts.push(
      subPath
        .split('/')
        .map((seg) => encodeURIComponent(seg))
        .join('/'),
    );
  }
  parts.push(encodeURIComponent(fileName));
  return parts.join('/');
}
