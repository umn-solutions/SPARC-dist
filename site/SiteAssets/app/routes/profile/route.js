import {
  Text,
  Container,
  Card,
  Image,
  Button,
  FormField,
  Toast,
  SiteApi,
  CurrentUser,
  StyleResource,
  resolvePath,
  defineRoute,
  FieldLabel,
  ComboBox,
  TextInput,
  TextArea,
  CheckBox,
  LinkButton,
} from '../../libs/nofbiz/nofbiz.base.js';
import { STATUSES, statusBadge } from '../../utils/status.js';
import { buildNavbar } from '../../utils/nav.js';
import { buildInitiativeCard } from '../initiatives/utils/card.js';
import { buildInitiativeFilterOptions, initiativeMatches } from '../initiatives/utils/filters.js';
import { getMyInitiatives } from './utils/myInitiatives.js';
import {
  buildProfileSchema,
  buildCappedCombo,
  WORK_LOCATIONS,
  SDG_GOALS,
  LANGUAGES,
  VOLUNTEERING_EXPERIENCE,
  MISSION_TYPES,
  AVAILABILITY,
  AREAS_OF_IMPACT,
  CSR_PILLARS,
} from './utils/profileSchema.js';
import { TagInput } from './utils/tagInput.js';
import { loadProfile, saveProfile } from './utils/profileApi.js';

export default defineRoute(async (config) => {
  config.setRouteTitle('My Profile');

  const routeStyles = new StyleResource(resolvePath('@/routes/profile/route.css'));
  await routeStyles.ready;

  // Placeholder doc link URLs -- fill these in before deployment.
  const DATA_PROTECTION_URL = 'https://placeholder.example.com/data-protection';
  const TERMS_URL = 'https://placeholder.example.com/volunteering-terms';

  const user = new CurrentUser();
  const email = user.get('email') || '';
  const displayName = user.get('displayName') || '';
  const employeeId = user.get('employeeId') || '';

  const list = new SiteApi().list('UserProfiles');

  // ---- helpers ----------------------------------------------------------------

  const getInitials = (name) => {
    if (!name) return '?';
    const parts = String(name).trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  const buildAvatar = () => {
    const pictureUrl = user.get('pictureUrl');
    if (pictureUrl) {
      return new Image(pictureUrl, { class: 'profile-avatar', alt: 'Profile photo' });
    }
    return new Container(
      [new Text(getInitials(displayName), { type: 'span', class: 'profile-avatar-initials' })],
      { class: 'profile-avatar-placeholder' },
    );
  };

  // Sidebar read-only label + value row.
  const detailRow = (label, value) =>
    new Container(
      [
        new Text(label, { type: 'span', class: 'profile-detail-label' }),
        new Text(value || '-', { type: 'span', class: 'profile-detail-value' }),
      ],
      { class: 'profile-detail-item' },
    );

  // KPI figure card.
  const makeFigure = (value, label) =>
    new Container(
      [
        new Text(String(value), { type: 'span', class: 'figure__value' }),
        new Text(label, { type: 'span', class: 'figure__label' }),
      ],
      { class: 'figure' },
    );

  // Renders a label + value row for the profile view section.
  const viewRow = (label, valueNode) =>
    new Container(
      [
        new Text(label, { type: 'span', class: 'profile-detail-label' }),
        valueNode,
      ],
      { class: 'profile-detail-item' },
    );

  // Renders an array of string tags as pills (reuses shared .initiative-tag CSS).
  const renderTagPills = (arr) => {
    if (!Array.isArray(arr) || arr.length === 0) {
      return new Text('-', { type: 'span', class: 'profile-detail-value' });
    }
    return new Container(
      arr.map((t) => new Text(String(t), { type: 'span', class: 'initiative-tag' })),
      { class: 'initiative-tags' },
    );
  };

  // ---- data loading -----------------------------------------------------------

  let allInitiatives = [];
  try {
    allInitiatives = await new SiteApi().list('Initiatives').getItems();
  } catch (err) {
    console.error('[Profile] getItems (Initiatives) failed', err);
    Toast.error('Could not load initiatives. Some profile data may be missing.');
  }

  // Load the persisted profile record (null if first visit).
  let record = await loadProfile(list, email);

  const myInitiatives = await getMyInitiatives(user, allInitiatives, new SiteApi().list('Registrations'));

  // ---- KPIs -------------------------------------------------------------------

  const totalInitiatives = myInitiatives.length;
  const totalHours = myInitiatives.reduce((sum, i) => {
    const n = Number(i.HoursPerVolunteer);
    return Number.isNaN(n) ? sum : sum + n;
  }, 0);
  const ongoingCount = myInitiatives.filter((i) => String(i.Status) === STATUSES.OPEN).length;

  // ---- sidebar ----------------------------------------------------------------

  const groups = user.get('groups') || [];
  const groupItems = groups.map((g) => {
    const title = typeof g === 'string' ? g : (g && (g.Title || g.title)) || '';
    return new Text(title, { type: 'span', class: 'profile-group-tag' });
  });

  const groupsSection =
    groupItems.length > 0
      ? new Card(
          [
            new Text('Groups', { type: 'span', class: 'profile-groups-title' }),
            new Container(groupItems, { class: 'profile-groups' }),
          ],
          { class: 'profile-groups surface' },
        )
      : null;

  const docLinks = new Container(
    [
      new LinkButton('Data protection notice', DATA_PROTECTION_URL, {
        variant: 'secondary',
        target: '_blank',
      }),
      new LinkButton('Volunteering terms and conditions', TERMS_URL, {
        variant: 'secondary',
        target: '_blank',
      }),
    ],
    { class: 'profile-doc-links' },
  );

  // ---- profile section (view/edit toggle) -------------------------------------

  // The profile section container whose .children are swapped between view and
  // edit mode. This avoids any page reload.
  const profileSection = new Container([], { class: 'profile-section' });

  const avatarCard = new Card(
    [
      buildAvatar(),
      new Text(displayName || '-', { type: 'h2', class: 'profile-name' }),
      new Text(user.get('jobTitle') || '-', { type: 'p', class: 'profile-job-title' }),
      new Container(
        [detailRow('Email', email)],
        { class: 'profile-detail-list' },
      ),
    ],
    { class: 'profile-card surface' },
  );

  const noticesCard = new Card(
    [
      new Text('Legal & data protection', { type: 'span', class: 'profile-notices-title' }),
      docLinks,
    ],
    { class: 'profile-notices surface' },
  );

  // Order: avatar card, profile section, groups (if any), notices card last.
  const sidebarChildren = [avatarCard, profileSection];
  if (groupsSection) sidebarChildren.push(groupsSection);
  sidebarChildren.push(noticesCard);

  const sidebar = new Container(sidebarChildren, { class: 'profile-sidebar' });

  // Tracks the current edit state (FormSchema + FormFields + TagInput refs).
  // Cleared every time we switch back to view mode so FormFields are disposed.
  let editState = null;

  // Save button reference; set inside buildEditChildren and used by handleSave.
  let saveBtn = null;

  // ---- view mode --------------------------------------------------------------

  const buildViewChildren = () => {
    const editButton = new Button('Edit profile', {
      variant: 'primary',
      onClickHandler: () => renderEdit(),
    });

    const sectionHeader = new Container(
      [
        new Text('Profile details', { type: 'h2', class: 'profile-section-title' }),
        editButton,
      ],
      { class: 'profile-section-header' },
    );

    // Returns false for null, undefined, empty string, and empty array.
    // Returns true for booleans, numbers, non-empty strings, and non-empty arrays.
    const hasValue = (v) => {
      if (v === null || v === undefined) return false;
      if (typeof v === 'boolean' || typeof v === 'number') return true;
      if (typeof v === 'string') return v.length > 0;
      if (Array.isArray(v)) return v.length > 0;
      return false;
    };

    // Returns a viewRow wrapping a Text span, or null when the value is empty.
    const textRow = (label, value) =>
      hasValue(value)
        ? viewRow(label, new Text(String(value), { type: 'span', class: 'profile-detail-value' }))
        : null;

    // Returns a viewRow wrapping tag pills, or null when the array is empty.
    const pillsRow = (label, arr) =>
      Array.isArray(arr) && arr.length > 0
        ? viewRow(label, renderTagPills(arr))
        : null;

    // Derived fields -- filter empties so a missing employeeId does not show a blank row.
    const derivedRows = [
      textRow('Name', displayName),
      textRow('Email', email),
      textRow('Employee ID', employeeId),
    ].filter(Boolean);

    const derivedGroup =
      derivedRows.length > 0
        ? new Container(derivedRows, { class: 'profile-view-group surface' })
        : null;

    if (!record) {
      return [
        sectionHeader,
        derivedGroup,
        new Container(
          [
            new Text("You haven't added your preferences yet.", { type: 'p' }),
            new Text('Click Edit profile to add your work, volunteering, and dietary details.', {
              type: 'p',
              class: 'empty-state-hint',
            }),
          ],
          { class: 'empty-state' },
        ),
      ].filter(Boolean);
    }

    // Work preferences -- only render rows that have data.
    const workRows = [
      textRow('Work location', record.WorkLocation),
      textRow('Group entity', record.Entity),
      typeof record.FullRemote === 'boolean'
        ? viewRow('Full remote', new Text(record.FullRemote ? 'Yes' : 'No', { type: 'span', class: 'profile-detail-value' }))
        : null,
      textRow('Skills to develop', record.SkillsToDevelop),
      textRow('Preferred area', record.PreferredArea),
    ].filter(Boolean);

    const workGroup =
      workRows.length > 0
        ? new Card(
            [new Text('Work preferences', { type: 'h3', class: 'profile-form-section-title' }), ...workRows],
            { class: 'profile-view-card surface' },
          )
        : null;

    // Volunteering preferences -- only render rows that have data.
    const volunteeringRows = [
      textRow('Volunteering experience', record.VolunteeringExperience),
      textRow('Preferred mission type', record.PreferredMissionType),
      textRow('Availability', record.Availability),
      textRow('Area of impact', record.AreaOfImpact),
      textRow('CSR pillar', record.CSRPillar),
    ].filter(Boolean);

    const volunteeringGroup =
      volunteeringRows.length > 0
        ? new Card(
            [new Text('Volunteering preferences', { type: 'h3', class: 'profile-form-section-title' }), ...volunteeringRows],
            { class: 'profile-view-card surface' },
          )
        : null;

    // Skills and interests -- mix of pills rows and a text row.
    const skillsRows = [
      pillsRow('SDGs', record.SDGs),
      pillsRow('Languages', record.Languages),
      pillsRow('Hobbies', record.Hobbies),
      pillsRow('Certifications', record.Certifications),
      pillsRow('Skills', record.Skills),
      hasValue(record.Interests)
        ? viewRow('Interests', new Text(record.Interests, { type: 'p', class: 'profile-view-text' }))
        : null,
    ].filter(Boolean);

    const skillsGroup =
      skillsRows.length > 0
        ? new Card(
            [new Text('Skills and interests', { type: 'h3', class: 'profile-form-section-title' }), ...skillsRows],
            { class: 'profile-view-card surface' },
          )
        : null;

    // Dietary preferences -- only render rows that have data.
    const dietRows = [
      hasValue(record.DietRequirements)
        ? viewRow('Diet requirements', new Text(record.DietRequirements, { type: 'p', class: 'profile-view-text' }))
        : null,
      hasValue(record.MealsNeeded)
        ? viewRow('Meals needed', new Text(record.MealsNeeded, { type: 'p', class: 'profile-view-text' }))
        : null,
    ].filter(Boolean);

    const dietGroup =
      dietRows.length > 0
        ? new Card(
            [new Text('Dietary preferences', { type: 'h3', class: 'profile-form-section-title' }), ...dietRows],
            { class: 'profile-view-card surface' },
          )
        : null;

    // Wrap surviving detail cards in a 2-column grid.
    const detailCards = [workGroup, volunteeringGroup, skillsGroup, dietGroup].filter(Boolean);
    const detailGrid =
      detailCards.length > 0 ? new Container(detailCards, { class: 'profile-view-grid' }) : null;

    return [sectionHeader, derivedGroup, detailGrid].filter(Boolean);
  };

  // ---- edit mode --------------------------------------------------------------

  const buildEditChildren = (schema, fields, tagInputs) => {
    const cancelButton = new Button('Cancel', {
      variant: 'secondary',
      onClickHandler: () => renderView(),
    });

    saveBtn = new Button('Save profile', {
      variant: 'primary',
      onClickHandler: () => handleSave(),
    });

    const derivedDisplay = new Container(
      [
        detailRow('Name', displayName),
        detailRow('Email', email),
        detailRow('Employee ID', employeeId),
      ],
      { class: 'profile-view-group surface' },
    );

    const workCard = new Card(
      [
        new Text('Work preferences', { type: 'h3', class: 'profile-form-section-title' }),
        new Container(
          [
            new FieldLabel('Work location', new ComboBox(fields.WorkLocation, WORK_LOCATIONS, { placeholder: 'Select location' }), { position: 'top' }),
            new FieldLabel('Group entity', new TextInput(fields.Entity, { placeholder: 'Enter your entity' }), { position: 'top' }),
            new FieldLabel('Full remote', new CheckBox(fields.FullRemote, {}), { position: 'top' }),
            new FieldLabel('Skills to develop', new TextInput(fields.SkillsToDevelop, { placeholder: 'Skills you want to develop' }), { position: 'top' }),
            new FieldLabel('Preferred area', new TextInput(fields.PreferredArea, { placeholder: 'City or area' }), { position: 'top' }),
          ],
          { class: 'profile-form-grid' },
        ),
      ],
      { class: 'profile-form-card surface' },
    );

    const volunteeringCard = new Card(
      [
        new Text('Volunteering preferences', { type: 'h3', class: 'profile-form-section-title' }),
        new Container(
          [
            new FieldLabel('Volunteering experience', new ComboBox(fields.VolunteeringExperience, VOLUNTEERING_EXPERIENCE, { placeholder: 'Select experience' }), { position: 'top' }),
            new FieldLabel('Preferred mission type', new ComboBox(fields.PreferredMissionType, MISSION_TYPES, { placeholder: 'Select mission type' }), { position: 'top' }),
            new FieldLabel('Availability', new ComboBox(fields.Availability, AVAILABILITY, { placeholder: 'Select availability' }), { position: 'top' }),
            new FieldLabel('Area of impact', new ComboBox(fields.AreaOfImpact, AREAS_OF_IMPACT, { placeholder: 'Select area' }), { position: 'top' }),
            new FieldLabel('CSR pillar', new ComboBox(fields.CSRPillar, CSR_PILLARS, { placeholder: 'Select pillar' }), { position: 'top' }),
          ],
          { class: 'profile-form-grid' },
        ),
      ],
      { class: 'profile-form-card surface' },
    );

    const skillsCard = new Card(
      [
        new Text('Skills and interests', { type: 'h3', class: 'profile-form-section-title' }),
        new Container(
          [
            new FieldLabel('Languages', new ComboBox(fields.Languages, LANGUAGES, { allowMultiple: true, allowCreate: true, allowFiltering: true, placeholder: 'Select or type languages' }), { position: 'top' }),
            new FieldLabel('SDGs (up to 3)', buildCappedCombo(fields.SDGs, SDG_GOALS, 3, { placeholder: 'Select SDGs' }), { position: 'top' }),
            new FieldLabel('Hobbies', tagInputs.Hobbies, { position: 'top' }),
            new FieldLabel('Certifications', tagInputs.Certifications, { position: 'top' }),
            new FieldLabel('Skills', tagInputs.Skills, { position: 'top' }),
            new FieldLabel('Interests', new TextArea(fields.Interests, { rows: 3, placeholder: 'Describe your interests...' }), { position: 'top' }),
          ],
          { class: 'profile-form-grid' },
        ),
      ],
      { class: 'profile-form-card surface' },
    );

    const dietCard = new Card(
      [
        new Text('Dietary preferences', { type: 'h3', class: 'profile-form-section-title' }),
        new Container(
          [
            new FieldLabel('Diet requirements', new TextArea(fields.DietRequirements, { rows: 2, placeholder: 'Any dietary requirements...' }), { position: 'top' }),
            new FieldLabel('Meals needed', new TextArea(fields.MealsNeeded, { rows: 2, placeholder: 'Meal preferences...' }), { position: 'top' }),
          ],
          { class: 'profile-form-grid' },
        ),
      ],
      { class: 'profile-form-card surface' },
    );

    const formActions = new Container(
      [cancelButton, saveBtn],
      { class: 'profile-form-actions' },
    );

    return [derivedDisplay, workCard, volunteeringCard, skillsCard, dietCard, formActions];
  };

  // ---- toggle functions -------------------------------------------------------

  const renderView = () => {
    // Dispose the previous edit state (FormFields + clear subscriber lists).
    if (editState) {
      for (const field of Object.values(editState.fields)) {
        field.dispose();
      }
      editState = null;
      saveBtn = null;
    }
    profileSection.children = buildViewChildren();
  };

  const renderEdit = () => {
    const { schema, fields } = buildProfileSchema(record);
    const tagInputs = {
      Hobbies: new TagInput(fields.Hobbies, { placeholder: 'Add hobbies...' }),
      Certifications: new TagInput(fields.Certifications, { placeholder: 'Add certifications...' }),
      Skills: new TagInput(fields.Skills, { placeholder: 'Add skills...' }),
    };
    editState = { schema, fields, tagInputs };
    profileSection.children = buildEditChildren(schema, fields, tagInputs);
  };

  // ---- save handler -----------------------------------------------------------

  const handleSave = async () => {
    if (!editState || !saveBtn) return;

    saveBtn.isLoading = true;

    // Validate all fields before hitting the network.
    const isValid = await editState.schema.validateAllAsync();
    if (!isValid) {
      editState.schema.focusOnFirstInvalid();
      Toast.error('Please fix the validation errors before saving.');
      saveBtn.isLoading = false;
      return;
    }

    const loading = Toast.loading('Saving profile...');
    try {
      const payload = editState.schema.parseForList();
      const derived = { Name: displayName, UID: employeeId };
      await saveProfile(list, email, derived, payload, record);

      loading.success('Profile saved.');
      // Reload the record so the view mode shows the latest values and the
      // next save uses a fresh ETag.
      record = await loadProfile(list, email);
      renderView();
    } catch (err) {
      console.error('[Profile] save failed', err);
      if (err && err.name === 'ConcurrencyConflict') {
        // Refresh the record so the next retry uses the current ETag.
        record = await loadProfile(list, email);
        loading.error('Profile was updated elsewhere. Please try again.');
      } else {
        loading.error('Could not save profile. Please try again.');
      }
    } finally {
      // Only reset isLoading if still in edit mode (save may have switched to view).
      if (saveBtn) saveBtn.isLoading = false;
    }
  };

  // ---- initial render: view mode ----------------------------------------------

  renderView();

  // ---- main area: KPIs + initiatives ------------------------------------------

  const kpiRow = new Container(
    [
      makeFigure(totalInitiatives, 'Total initiatives'),
      makeFigure(totalHours, 'Total hours'),
      makeFigure(ongoingCount, 'Ongoing'),
    ],
    { class: 'profile-kpis' },
  );

  const initiativesCount = myInitiatives.length;
  const countLabelText = `${initiativesCount} initiative${initiativesCount === 1 ? '' : 's'}`;

  // countContainer wraps the count text so its children can be replaced on each
  // filter update without touching .instance directly.
  const countContainer = new Container(
    [new Text(countLabelText, { type: 'span', class: 'profile-initiatives-count' })],
    {},
  );

  const initiativesHeader = new Container(
    [
      new Text('My initiatives', { type: 'h2', class: 'profile-initiatives-title' }),
      countContainer,
    ],
    { class: 'profile-initiatives-header' },
  );

  let main;
  if (myInitiatives.length === 0) {
    const emptyState = new Container(
      [
        new Text('No initiatives found.', { type: 'p' }),
        new Text('Browse the Initiatives page to find opportunities.', {
          type: 'p',
          class: 'empty-state-hint',
        }),
      ],
      { class: 'empty-state' },
    );
    main = new Container([kpiRow, initiativesHeader, emptyState], { class: 'profile-main' });
  } else {
    const { statusOptions, sdgOptions, locationOptions } = buildInitiativeFilterOptions(myInitiatives);

    const searchField = new FormField({ value: '' });
    const statusField = new FormField({ value: null });
    const sdgField = new FormField({ value: null });
    const locationField = new FormField({ value: null });

    // Wraps a card with a registration-status badge when the initiative carries
    // a RegistrationStatus. Falls back to the plain card when status is absent.
    const buildMyCard = (i) => {
      if (!i.RegistrationStatus) return buildInitiativeCard(i);
      return new Container(
        [
          new Container([statusBadge(i.RegistrationStatus)], { class: 'profile-initiative-status' }),
          buildInitiativeCard(i),
        ],
        { class: 'profile-initiative-item' },
      );
    };

    const catalogGrid = new Container(myInitiatives.map(buildMyCard), { class: 'catalog-grid' });

    const applyFilters = () => {
      const filtered = myInitiatives.filter((it) =>
        initiativeMatches(it, {
          search: searchField.value,
          status: statusField.value?.value ?? '',
          sdg: sdgField.value?.value ?? '',
          location: locationField.value?.value ?? '',
        })
      );
      const n = filtered.length;
      countContainer.children = [new Text(`${n} initiative${n === 1 ? '' : 's'}`, { type: 'span', class: 'profile-initiatives-count' })];
      catalogGrid.children = filtered.length === 0
        ? [new Text('No initiatives match your filters.', { type: 'p', class: 'empty-state-hint' })]
        : filtered.map(buildMyCard);
    };

    searchField.subscribe(() => applyFilters());
    statusField.subscribe(() => applyFilters());
    sdgField.subscribe(() => applyFilters());
    locationField.subscribe(() => applyFilters());

    const filterBar = new Container(
      [
        new FieldLabel('Search', new TextInput(searchField, { placeholder: 'Search name, association, or mission...', debounceMs: 250 }), { position: 'top', class: 'filter-search' }),
        new FieldLabel('Status', new ComboBox(statusField, statusOptions, { placeholder: 'All statuses' }), { position: 'top' }),
        new FieldLabel('SDG', new ComboBox(sdgField, sdgOptions, { placeholder: 'All SDGs' }), { position: 'top' }),
        new FieldLabel('Location', new ComboBox(locationField, locationOptions, { placeholder: 'All locations' }), { position: 'top' }),
      ],
      { class: 'catalog-filters surface' },
    );

    main = new Container([kpiRow, initiativesHeader, filterBar, catalogGrid], { class: 'profile-main' });
  }

  // ---- page layout ------------------------------------------------------------

  const layout = new Container(
    [sidebar, main],
    { class: 'profile-layout shell' },
  );

  return [buildNavbar(user, 'profile'), layout];
});
