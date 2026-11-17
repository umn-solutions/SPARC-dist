import { SiteApi, escapeHtml } from '../libs/nofbiz/nofbiz.base.js';
import { SITE_CONTENT_LIST, SITE_CONTENT } from './siteContentDefaults.js';

/**
 * Loads site content from the SiteContent list and returns a synchronous getter.
 * Falls back to defaults from SITE_CONTENT on any list error or missing/blank rows.
 * Content returned by the getter is HTML-escaped and safe to pass to Text components.
 *
 * @param {string} prefix - CAML Title BeginsWith filter, e.g. 'home.'
 * @returns {function(string): string} getter(key) -> escaped string
 */
export async function loadSiteContent(prefix) {
  let rows = [];
  try {
    rows = await new SiteApi().list(SITE_CONTENT_LIST).getItems(
      { Title: { value: prefix, operator: 'BeginsWith' } },
      { viewFields: ['Title', 'Content'] },
    );
  } catch (err) {
    console.warn('[siteContent] failed to load list content', { prefix, err });
  }

  // Build key -> content map, handling duplicates and type coercion.
  const contentMap = new Map();
  const seen = new Set();
  for (const row of rows) {
    const key = row.Title;
    if (seen.has(key)) {
      console.warn('[siteContent] duplicate row for key - using first occurrence', { key });
      continue;
    }
    seen.add(key);

    let content = row.Content;

    if (content === null || content === undefined) {
      // Empty field -- skip, default will apply.
      continue;
    }

    if (typeof content !== 'string') {
      // ListApi auto-parses booleans and numbers from stored strings.
      if (typeof content === 'boolean' || typeof content === 'number') {
        content = String(content);
      } else {
        // Object or array -- not a valid text field value; fall back to default.
        console.warn('[siteContent] Content returned unexpected type - falling back to default', {
          key,
          type: typeof content,
          value: content,
        });
        continue;
      }
    }

    if (content.trim()) {
      contentMap.set(key, content.trim());
    }
  }

  // Raw getter: returns the resolved text without HTML escaping.
  // Use only when the value is NOT being passed to a Text component or HTML
  // attribute -- e.g. when encoding it via encodeURIComponent for a URL.
  function getRaw(key) {
    if (!(key in SITE_CONTENT)) {
      console.warn('[siteContent] unknown key requested', { key });
      return '';
    }
    const listValue = contentMap.get(key);
    return listValue !== undefined ? listValue : SITE_CONTENT[key].text;
  }

  function t(key) {
    return escapeHtml(getRaw(key));
  }

  // Expose the raw getter as a property so callers can do t.raw(key).
  t.raw = getRaw;

  return t;
}

/**
 * Splits a text string on blank lines and returns non-empty trimmed paragraphs.
 * Accepts both raw and already-escaped text; does not perform any escaping.
 *
 * @param {string} text
 * @returns {string[]}
 */
export function toParagraphs(text) {
  if (!text) return [];
  return text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
}
