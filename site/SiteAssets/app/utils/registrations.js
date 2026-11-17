// ---------------------------------------------------------------------------
// registrations.js
//
// Shared data-access utilities for the Registrations list.
//
// READ helpers always catch errors: they log to console and return a safe
// default so that calling pages can still render on partial failure.
//
// WRITE helpers do NOT catch: callers wrap them in try/catch to show Toast
// feedback and handle ConcurrencyConflict (HTTP 412 from stale etag).
// ---------------------------------------------------------------------------

// -- Domain constants -------------------------------------------------------

export const REG_STATUSES = {
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
};

export const REGISTRATION_MODES = {
  AUTO: 'Auto',
  VALIDATION: 'Validation',
};

// -- READ helpers ------------------------------------------------------------

/**
 * Returns the user's registration row for the given initiative, or null.
 * Includes `odata.etag` on the returned item (auto-provided by ListApi).
 *
 * @param {object} list - ListApi instance for the Registrations list.
 * @param {string|number} initiativeId
 * @param {string} email - The user's email (UserEmail field, join key).
 * @returns {Promise<object|null>}
 */
export async function getUserRegistration(list, initiativeId, email) {
  try {
    const items = await list.getItems({
      InitiativeId: String(initiativeId),
      UserEmail: email,
    });
    return items && items.length > 0 ? items[0] : null;
  } catch (err) {
    console.error('[registrations.getUserRegistration] getItems failed', { initiativeId, email, err });
    return null;
  }
}

/**
 * Returns the number of current registrations for the given initiative.
 * When `status` is provided, counts only registrations with that status.
 *
 * Returns Infinity on error rather than 0. Returning 0 would allow a new
 * registration to proceed even when the real count is at or above capacity,
 * which could silently breach the cap. Infinity causes `isInitiativeFull`
 * to block when a capacity limit is configured (fail-safe).
 *
 * @param {object} list - ListApi instance for the Registrations list.
 * @param {string|number} initiativeId
 * @param {string} [status] - Optional status to filter by (e.g. REG_STATUSES.ACCEPTED).
 * @returns {Promise<number>}
 */
export async function countRegistrations(list, initiativeId, status) {
  const query = status != null
    ? { InitiativeId: String(initiativeId), Status: status }
    : { InitiativeId: String(initiativeId) };
  try {
    const items = await list.getItems(query, { viewFields: ['Id'] });
    return items.length;
  } catch (err) {
    console.error('[registrations.countRegistrations] getItems failed', { initiativeId, status, err });
    // Infinity is intentional: see function comment above.
    return Infinity;
  }
}

/**
 * Returns all registration rows for the given user email (across all
 * initiatives). Used by the profile page to build "My initiatives".
 *
 * @param {object} list - ListApi instance for the Registrations list.
 * @param {string} email - The user's email.
 * @returns {Promise<object[]>}
 */
export async function getUserRegistrations(list, email) {
  try {
    const items = await list.getItems({ UserEmail: email });
    return items || [];
  } catch (err) {
    console.error('[registrations.getUserRegistrations] getItems failed', { email, err });
    return [];
  }
}

/**
 * Returns all registration rows for the given initiative (full rows, including
 * odata.etag). Used by the admin Manage tab to list registered volunteers.
 *
 * @param {object} list - ListApi instance for the Registrations list.
 * @param {string|number} initiativeId
 * @returns {Promise<object[]>}
 */
export async function getInitiativeRegistrations(list, initiativeId) {
  try {
    const items = await list.getItems({ InitiativeId: String(initiativeId) });
    return items || [];
  } catch (err) {
    console.error('[registrations.getInitiativeRegistrations] getItems failed', { initiativeId, err });
    return [];
  }
}

// -- WRITE helpers -----------------------------------------------------------

/**
 * Creates a new registration row in the Registrations list.
 * Does NOT catch -- callers must wrap in try/catch.
 *
 * @param {object} list - ListApi instance for the Registrations list.
 * @param {{ initiativeId, initiativeTitle, email, name, transportNeeded, dietaryPreferences, notes, status? }} data
 *   `status` defaults to REG_STATUSES.ACCEPTED when omitted (backward-compatible).
 * @returns {Promise<void>}
 */
export async function createRegistration(list, data) {
  const { initiativeId, initiativeTitle, email, name, transportNeeded, dietaryPreferences, notes, status } = data;
  return list.createItem({
    Title: `${name} — ${initiativeTitle}`,
    InitiativeId: String(initiativeId),
    InitiativeTitle: initiativeTitle,
    UserEmail: email,
    UserName: name,
    TransportNeeded: transportNeeded ? 'true' : 'false',
    DietaryPreferences: dietaryPreferences || '',
    Notes: notes || '',
    Status: status != null ? status : REG_STATUSES.ACCEPTED,
  });
}

/**
 * Updates a registration's Status to Accepted.
 * Does NOT catch -- callers must wrap in try/catch to handle
 * ConcurrencyConflict (HTTP 412 on stale etag).
 *
 * @param {object} list - ListApi instance for the Registrations list.
 * @param {number} registrationId - The SP integer Id of the registration item.
 * @param {string} etag - The ETag for optimistic concurrency.
 * @returns {Promise<void>}
 */
export async function acceptRegistration(list, registrationId, etag) {
  return list.updateItem(registrationId, { Status: REG_STATUSES.ACCEPTED }, etag);
}

/**
 * Hard-deletes a registration row. Does NOT catch -- callers must wrap in
 * try/catch to handle ConcurrencyConflict (HTTP 412 on stale etag).
 *
 * @param {object} list - ListApi instance for the Registrations list.
 * @param {number} registrationId - The SP integer Id of the registration item.
 * @param {string} etag - The ETag for optimistic concurrency.
 * @returns {Promise<void>}
 */
export async function cancelRegistration(list, registrationId, etag) {
  return list.deleteItem(registrationId, etag);
}

// -- Pure helper -------------------------------------------------------------

/**
 * Returns true when the initiative has reached its volunteer cap.
 *
 * No cap is enforced when `volunteersNeeded` is absent, empty, zero, or
 * non-numeric -- those cases return false.
 *
 * @param {string|number|null|undefined} volunteersNeeded - Value from the
 *   Initiatives list (stored as a string in SP).
 * @param {number} currentCount - Current number of registrations.
 * @returns {boolean}
 */
export function isInitiativeFull(volunteersNeeded, currentCount) {
  const cap = parseInt(volunteersNeeded, 10);
  if (!Number.isFinite(cap) || cap <= 0) return false;
  return currentCount >= cap;
}
