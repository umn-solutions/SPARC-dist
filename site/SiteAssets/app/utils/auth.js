// TODO: Replace ADMIN_GROUP with the actual SharePoint group name once confirmed.
export const ADMIN_GROUP = 'Events Portal Admins';

// Returns true if the user belongs to ADMIN_GROUP.
// Handles group entries that may be plain strings or objects with a title/Title property.
// Returns false when the groups list is absent or empty.
export function isAdmin(user) {
  const groups = user.get('groups');
  if (!groups || !Array.isArray(groups)) return false;
  return groups.some((g) => {
    if (!g) return false;
    if (typeof g === 'string') return g === ADMIN_GROUP;
    // SP group objects expose Title (capitalized) from the API
    const title = g.Title || g.title || '';
    return title === ADMIN_GROUP;
  });
}
