// ---------------------------------------------------------------------------
// profileApi.js
//
// Load and upsert helpers for the UserProfiles list.
// Every function that hits the network has a try/catch + console.error.
// ---------------------------------------------------------------------------

/**
 * Loads the profile record for the given email (= Title field).
 * Returns the first matching item or null.
 * Never throws -- on failure it logs and returns null so the page still renders.
 *
 * @param {ListApi} list - ListApi instance for the UserProfiles list.
 * @param {string}  email - The current user's email (used as Title / upsert key).
 * @returns {Promise<object|null>}
 */
export async function loadProfile(list, email) {
  try {
    const items = await list.getItemByTitle(email);
    return items && items.length > 0 ? items[0] : null;
  } catch (err) {
    console.error('[profileApi.loadProfile] getItemByTitle failed', err);
    return null;
  }
}

/**
 * Upsert the user profile.
 * - Update (MERGE) when `existingRecord` is provided (caller passes the
 *   record it has; this avoids a redundant network call to check existence).
 * - Create when `existingRecord` is null/undefined.
 *
 * Does NOT catch errors -- the route's save handler wraps this in try/catch
 * so it can show Toast feedback and handle ConcurrencyConflict (HTTP 412).
 *
 * @param {ListApi} list           - ListApi instance for the UserProfiles list.
 * @param {string}  email          - The current user's email (Title field value).
 * @param {object}  derived        - Derived read-only fields: { Name, UID }.
 * @param {object}  payload        - Form fields from schema.parseForList().
 * @param {object|null} existingRecord - The record loaded at route init, or null.
 */
export async function saveProfile(list, email, derived, payload, existingRecord) {
  const merged = { ...derived, ...payload };

  if (existingRecord) {
    const etag = existingRecord['odata.etag'];
    await list.updateItem(existingRecord.ID, merged, etag);
  } else {
    await list.createItem({ Title: email, ...merged });
  }
}
