import { Container, Text } from '../libs/nofbiz/nofbiz.base.js';
import { REG_STATUSES } from './registrations.js';

export const STATUSES = {
  OPEN: 'Open',
  CANCELLED: 'Cancelled',
  CLOSED: 'Closed',
};

// Maps a status value to display metadata.
// kind drives the CSS modifier on .status-badge.
// Covers both initiative statuses (open/cancelled/closed) and
// registration statuses (accepted/pending).
const STATUS_META = {
  [STATUSES.OPEN]: { label: 'Open', kind: 'open' },
  [STATUSES.CANCELLED]: { label: 'Cancelled', kind: 'cancelled' },
  [STATUSES.CLOSED]: { label: 'Closed', kind: 'closed' },
  [REG_STATUSES.ACCEPTED]: { label: 'Accepted', kind: 'accepted' },
  [REG_STATUSES.PENDING]: { label: 'Pending', kind: 'pending' },
};

// Returns a Container with BEM modifier classes for badge styling.
// Falls back to a neutral badge for unknown or empty status values.
export function statusBadge(status) {
  const meta = STATUS_META[status];
  const label = meta ? meta.label : (status || 'Unknown');
  const kind = meta ? meta.kind : 'unknown';
  return new Container(
    [new Text(label, { type: 'span' })],
    { class: `status-badge status-badge--${kind}` },
  );
}
