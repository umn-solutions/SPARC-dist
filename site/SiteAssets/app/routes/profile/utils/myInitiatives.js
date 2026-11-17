import { getUserRegistrations } from '../../../utils/registrations.js';

/**
 * Returns the subset of allInitiatives that the current user is registered for,
 * each augmented with a `RegistrationStatus` property ('Accepted' | 'Pending' | '').
 * Queries the Registrations list by the user's email (UserEmail field = join key).
 *
 * @param {object} user - Initialized CurrentUser instance.
 * @param {Array}  allInitiatives - Full list fetched from the Initiatives SP list.
 * @param {object} regList - ListApi instance for the Registrations list.
 * @returns {Promise<Array>} Initiatives the user is registered for, each carrying
 *   a `RegistrationStatus` string from the matching registration row.
 */
export async function getMyInitiatives(user, allInitiatives, regList) {
  const registrations = await getUserRegistrations(regList, user.get('email'));
  const involvedIds = new Set(registrations.map((r) => Number(r.InitiativeId)));
  const statusById = new Map(registrations.map((r) => [Number(r.InitiativeId), r.Status]));
  return allInitiatives
    .filter((i) => involvedIds.has(Number(i.Id)))
    .map((i) => ({ ...i, RegistrationStatus: statusById.get(Number(i.Id)) || '' }));
}
