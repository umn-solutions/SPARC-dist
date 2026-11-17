import {
  Text,
  Container,
  Image,
  Toast,
  SiteApi,
  CurrentUser,
  StyleResource,
  resolvePath,
  defineRoute,
  FieldLabel,
  FormField,
  TextInput,
  ComboBox,
} from '../../libs/nofbiz/nofbiz.base.js';
import { buildNavbar } from '../../utils/nav.js';
import { buildInitiativeCard } from './utils/card.js';
import { buildInitiativeFilterOptions, initiativeMatches } from './utils/filters.js';

export default defineRoute(async (config) => {
  config.setRouteTitle('Initiatives');

  const routeStyles = new StyleResource(resolvePath('@/routes/initiatives/route.css'));
  await routeStyles.ready;

  const user = new CurrentUser();
  const siteApi = new SiteApi();

  let items;
  try {
    items = await siteApi.list('Initiatives').getItems();
  } catch (err) {
    console.error('[initiatives] getItems failed:', err);
    Toast.error(err && err.message ? err.message : 'Failed to load initiatives.');
    return [
      buildNavbar(user, 'initiatives'),
      new Container([new Text('Failed to load initiatives.', { type: 'p' })]),
    ];
  }

  // Count label lives in a Container so its children can be replaced on each
  // filter update without touching .instance directly.
  const initialCount = items.length;
  const initialCountText = `${initialCount} initiative${initialCount === 1 ? '' : 's'}`;
  const countLabel = new Container(
    [new Text(initialCountText, { type: 'p', class: 'section-lead' })],
    {},
  );

  const heroBand = new Container(
    [
      new Container(
        [
          new Container(
            [
              new Text('Volunteer portal', { type: 'span', class: 'eyebrow' }),
              new Text('Initiatives', { type: 'h1', class: 'hero__title' }),
              new Text(
                'Browse open volunteering initiatives and find a cause that fits your skills and schedule.',
                { type: 'p', class: 'hero__sub' },
              ),
            ],
            { class: 'hero__inner' },
          ),
          new Image('../SiteAssets/app/media/initiatives-hero.png', { class: 'hero__image', alt: 'Initiatives' }),
        ],
        { class: 'shell' },
      ),
    ],
    { class: 'hero' },
  );

  // Empty-list state: list has no items at all -- no filter UI needed.
  if (items.length === 0) {
    return [
      buildNavbar(user, 'initiatives'),
      heroBand,
      new Container(
        [
          new Text('No initiatives yet.', { type: 'p' }),
          new Text(
            'Import via the Admin route to populate this list.',
            { type: 'p', class: 'empty-state-hint' },
          ),
        ],
        { class: 'empty-state' },
      ),
    ];
  }

  // -- Option datasets -------------------------------------------------------
  const { statusOptions, sdgOptions, locationOptions } = buildInitiativeFilterOptions(items);

  // -- Filter state ----------------------------------------------------------
  // FormField is correct here: these are user-interactive inputs.
  const searchField = new FormField({ value: '' });
  const statusField = new FormField({ value: null });
  const sdgField = new FormField({ value: null });
  const locationField = new FormField({ value: null });

  // -- Grid (children replaced by applyFilters) ------------------------------
  const catalogGrid = new Container(items.map(buildInitiativeCard), { class: 'catalog-grid' });

  // -- Filter logic ----------------------------------------------------------
  // All four filters combine with AND. An empty/null filter value is a no-op.
  // ComboBox fields store { label, value } objects; read .value for the scalar.
  // The "All" sentinel has value '', which is falsy and therefore skips the filter.
  function applyFilters() {
    const filtered = items.filter((it) =>
      initiativeMatches(it, {
        search: searchField.value,
        status: statusField.value?.value ?? '',
        sdg: sdgField.value?.value ?? '',
        location: locationField.value?.value ?? '',
      })
    );

    // Update count in the header band.
    const n = filtered.length;
    countLabel.children = [
      new Text(`${n} initiative${n === 1 ? '' : 's'}`, { type: 'p', class: 'section-lead' }),
    ];

    // Update grid or show the filtered-empty message.
    catalogGrid.children = filtered.length === 0
      ? [new Text('No initiatives match your filters.', { type: 'p', class: 'empty-state-hint' })]
      : filtered.map(buildInitiativeCard);
  }

  searchField.subscribe(() => applyFilters());
  statusField.subscribe(() => applyFilters());
  sdgField.subscribe(() => applyFilters());
  locationField.subscribe(() => applyFilters());

  // -- Filter bar ------------------------------------------------------------
  const searchInput = new TextInput(searchField, {
    placeholder: 'Search name, association, or mission...',
    debounceMs: 250,
  });
  const statusCombo = new ComboBox(statusField, statusOptions, {
    placeholder: 'All statuses',
  });
  const sdgCombo = new ComboBox(sdgField, sdgOptions, {
    placeholder: 'All SDGs',
  });
  const locationCombo = new ComboBox(locationField, locationOptions, {
    placeholder: 'All locations',
  });

  const filterBar = new Container(
    [
      new FieldLabel('Search', searchInput, { position: 'top', class: 'filter-search' }),
      new FieldLabel('Status', statusCombo, { position: 'top' }),
      new FieldLabel('SDG', sdgCombo, { position: 'top' }),
      new FieldLabel('Location', locationCombo, { position: 'top' }),
    ],
    { class: 'catalog-filters surface' },
  );

  const body = new Container([countLabel, filterBar, catalogGrid], { class: 'shell' });

  return [buildNavbar(user, 'initiatives'), heroBand, body];
});
