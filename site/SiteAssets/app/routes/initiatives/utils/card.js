import {
  Text,
  Container,
  Card,
  Router,
  __dayjs,
} from '../../../libs/nofbiz/nofbiz.base.js';
import { statusBadge } from '../../../utils/status.js';

// Formats a date value to YYYY-MM-DD, returns empty string for missing/invalid.
export function formatDate(value) {
  if (value == null || value === '') return '';
  const parsed = __dayjs(value);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : String(value);
}

// Coerces null/undefined to empty string.
export function str(v) {
  return v == null ? '' : String(v);
}

// Renders a two-line chip (label on top, value below).
export function chip(label, value) {
  return new Container(
    [
      new Text(label, { type: 'span', class: 'chip-label' }),
      new Text(str(value) || '-', { type: 'span', class: 'chip-value' }),
    ],
    { class: 'chip' },
  );
}

// Builds a clickable initiative summary card.
// Navigates to initiatives/detail when clicked.
export function buildInitiativeCard(item) {
  const title = str(item.Title) || `${str(item.AssociationName)} - ${str(item.MissionName)}`.trim();
  const tags = [];
  if (item.SDG1) tags.push(new Text(str(item.SDG1), { type: 'span', class: 'initiative-tag' }));
  if (item.SDG2) tags.push(new Text(str(item.SDG2), { type: 'span', class: 'initiative-tag' }));
  if (item.SDG3) tags.push(new Text(str(item.SDG3), { type: 'span', class: 'initiative-tag' }));

  const card = new Card(
    [
      new Container(
        [
          new Text(title, { type: 'h3', class: 'initiative-title' }),
          new Text(str(item.AssociationName), { type: 'p', class: 'initiative-association' }),
          tags.length > 0
            ? new Container(tags, { class: 'initiative-tags' })
            : new Container([], { class: 'initiative-tags' }),
          statusBadge(str(item.Status)),
        ],
        { class: 'initiative-header' },
      ),
      new Container(
        [
          chip('Location', item.MissionLocation),
          chip('Volunteers needed', item.VolunteersNeeded),
          chip('Register by', formatDate(item.RegistrationDeadline)),
        ],
        { class: 'chip-row' },
      ),
    ],
    { class: 'summary-card summary-card--clickable surface' },
  );
  card.onClickHandler = () => {
    Router.navigateTo('initiatives/detail', { query: { id: String(item.Id) } });
  };
  return card;
}
