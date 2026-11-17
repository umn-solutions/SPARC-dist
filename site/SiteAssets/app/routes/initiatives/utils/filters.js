import { str } from './card.js';

// Builds a distinct, sorted { label, value }[] from an array of raw values.
// Prefixes the result with an { label: 'All', value: '' } sentinel.
export function distinctSortedOptions(values) {
  const seen = new Set();
  const unique = [];
  for (const v of values) {
    const s = v == null ? '' : String(v);
    if (s && !seen.has(s)) {
      seen.add(s);
      unique.push(s);
    }
  }
  unique.sort();
  return [{ label: 'All', value: '' }, ...unique.map((v) => ({ label: v, value: v }))];
}

// Derives filter option arrays from a list of initiative items.
// Returns { statusOptions, sdgOptions, locationOptions }.
export function buildInitiativeFilterOptions(items) {
  const statusOptions = distinctSortedOptions(items.map((i) => i.Status));

  // SDG options are the union of SDG1, SDG2, and SDG3 across all items.
  const sdgOptions = distinctSortedOptions([
    ...items.map((i) => i.SDG1),
    ...items.map((i) => i.SDG2),
    ...items.map((i) => i.SDG3),
  ]);

  const locationOptions = distinctSortedOptions(items.map((i) => i.MissionLocation));

  return { statusOptions, sdgOptions, locationOptions };
}

// Returns true when `item` satisfies all four filter criteria.
// Empty/falsy criteria are no-ops so callers can pass '' or null to skip a filter.
// search: case-insensitive substring across Title, AssociationName, MissionName.
// status: exact match on Status.
// sdg: item matches if any of SDG1/SDG2/SDG3 equals the value.
// location: exact match on MissionLocation.
export function initiativeMatches(item, { search, status, sdg, location }) {
  const searchTerm = (search || '').toLowerCase().trim();
  if (searchTerm) {
    const haystack = [str(item.Title), str(item.AssociationName), str(item.MissionName)]
      .join(' ')
      .toLowerCase();
    if (!haystack.includes(searchTerm)) return false;
  }
  if (status && str(item.Status) !== status) return false;
  if (sdg && str(item.SDG1) !== sdg && str(item.SDG2) !== sdg && str(item.SDG3) !== sdg) return false;
  if (location && str(item.MissionLocation) !== location) return false;
  return true;
}
