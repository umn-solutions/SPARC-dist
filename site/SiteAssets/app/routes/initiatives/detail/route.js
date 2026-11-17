import {
  Text,
  Container,
  Button,
  ComboBox,
  Modal,
  Dialog,
  Toast,
  SiteApi,
  CurrentUser,
  StyleResource,
  FormField,
  TextInput,
  TextArea,
  CheckBox,
  FieldLabel,
  extractComboBoxValue,
  resolvePath,
  defineRoute,
  Router,
  LinkButton,
  __dayjs,
} from '../../../libs/nofbiz/nofbiz.base.js';
import { statusBadge } from '../../../utils/status.js';
import { buildNavbar } from '../../../utils/nav.js';
import {
  REG_STATUSES,
  REGISTRATION_MODES,
  getUserRegistration,
  countRegistrations,
  createRegistration,
  cancelRegistration,
  isInitiativeFull,
} from '../../../utils/registrations.js';
import { loadProfile } from '../../profile/utils/profileApi.js';

export default defineRoute(async (config) => {
  config.setRouteTitle('Initiative Detail');

  const routeStyles = new StyleResource(resolvePath('@/routes/initiatives/detail/route.css'));
  await routeStyles.ready;

  const user = new CurrentUser();
  const email = user.get('email') || '';
  const name = user.get('displayName') || '';

  // -- helpers --

  const str = (v) => (v == null ? '' : String(v));

  // Dietary preference options for the registration ComboBox. allowCreate is on,
  // so a volunteer can also type a custom value (e.g. a specific allergy).
  const DIETARY_OPTIONS = [
    'No restrictions',
    'Vegetarian',
    'Vegan',
    'Pescatarian',
    'Halal',
    'Kosher',
    'Lactose-free',
    'Gluten-free',
    'Nut allergy',
  ];

  // The options actually passed to the dietary ComboBox. A saved profile
  // preference not present in DIETARY_OPTIONS is injected below so it can display.
  let dietOptions = DIETARY_OPTIONS;

  // Wrap a stored string as a ComboBox option object ({ label, value }), or null.
  const toDietOption = (s) => (s ? { label: String(s), value: String(s) } : null);

  const formatDate = (value) => {
    if (value == null || value === '') return '';
    const parsed = __dayjs(value);
    return parsed.isValid() ? parsed.format('YYYY-MM-DD') : String(value);
  };

  // Renders a single label/value row. Returns null when value is empty.
  const fieldRow = (label, value) => {
    const display = str(value).trim();
    if (!display) return null;
    return new Container(
      [
        new Text(label, { type: 'span', class: 'detail-label' }),
        new Text(display, { type: 'span', class: 'detail-value' }),
      ],
      { class: 'detail-row' },
    );
  };

  // Renders a labelled section containing an array of field rows,
  // omitting entirely if every row is empty.
  const detailSection = (heading, rows) => {
    const populated = rows.filter(Boolean);
    if (populated.length === 0) return null;
    return new Container(
      [
        new Text(heading, { type: 'h2', class: 'detail-section-title' }),
        new Container(populated, { class: 'detail-section-body' }),
      ],
      { class: 'detail-section surface' },
    );
  };

  // -- read query param --

  const id = Router.queryParams.get('id');

  // -- not-found helper --

  const renderNotFound = (message) =>
    new Container(
      [
        new Text(message, { type: 'p', class: 'detail-not-found' }),
        new LinkButton('Back to initiatives', 'initiatives', {
          class: 'detail-back-link',
        }),
      ],
      { class: 'detail-not-found-shell shell' },
    );

  if (!id) {
    return [
      buildNavbar(user, 'initiatives'),
      renderNotFound('No initiative selected.'),
    ];
  }

  // -- fetch initiative --

  let item;
  try {
    const siteApi = new SiteApi();
    // Id is a Counter field; the CAML builder emits Type="Text" for filter values,
    // so an { Id } filter is unreliable. The list is small -- fetch and match in JS.
    const items = await siteApi.list('Initiatives').getItems();
    item = items.find((i) => String(i.Id) === String(id));
  } catch (err) {
    console.error('[initiatives/detail] getItems failed', { id, err });
    Toast.error('Failed to load initiative. Please try again.');
    return [
      buildNavbar(user, 'initiatives'),
      renderNotFound('Could not load this initiative.'),
    ];
  }

  if (!item) {
    return [
      buildNavbar(user, 'initiatives'),
      renderNotFound('Initiative not found.'),
    ];
  }

  // -- set title --

  const title =
    str(item.Title) ||
    [str(item.AssociationName), str(item.MissionName)].filter(Boolean).join(' - ');

  config.setRouteTitle(title || 'Initiative Detail');

  // -- registration mode --

  // Default to Auto when the field is absent/empty (backward-compatible).
  const mode =
    str(item.RegistrationMode) === REGISTRATION_MODES.VALIDATION
      ? REGISTRATION_MODES.VALIDATION
      : REGISTRATION_MODES.AUTO;

  // -- registration setup --

  const regList = new SiteApi().list('Registrations');
  const profileList = new SiteApi().list('UserProfiles');

  // Form fields for the registration form (persist across modal opens).
  const transportField = new FormField({ value: false });
  const dietField = new FormField({ value: [] });
  const notesField = new FormField({ value: '' });

  // Current registration state: updated on register / cancel.
  let currentReg = null;
  // Tracks the accepted volunteer count (used for capacity gating in Auto mode).
  let regCount = 0;

  // Fetch registration state and user profile in parallel.
  // Use accepted-only count: the cap applies to accepted volunteers only.
  const [fetchedReg, fetchedCount, profile] = await Promise.all([
    getUserRegistration(regList, id, email),
    countRegistrations(regList, id, REG_STATUSES.ACCEPTED),
    loadProfile(profileList, email),
  ]);

  currentReg = fetchedReg;
  regCount = fetchedCount;

  // Pre-fill dietary preferences from saved profile (if available).
  const savedDiet = profile && profile.DietRequirements ? String(profile.DietRequirements).trim() : '';
  if (savedDiet) {
    // If the saved preference is not one of the fixed options (e.g. a custom
    // "Vegetarian, no nuts"), inject it so the ComboBox displays it selected.
    const known = DIETARY_OPTIONS.some((o) => o.toLowerCase() === savedDiet.toLowerCase());
    if (!known) dietOptions = [savedDiet, ...DIETARY_OPTIONS];
    dietField.value = [toDietOption(savedDiet)];
  }

  // -- registration modal --

  // Standalone modals must declare a containerSelector -- render() appends into
  // $(containerSelector), which is an empty set (a no-op) when unset. #root is
  // the route mount point (matches the framework SidePanel). Mounted lazily on
  // first open() so the Router's route render does not wipe an init-time mount.
  const modal = new Modal([], {
    containerSelector: '#root',
    backdrop: true,
    closeOnFocusLoss: false,
  });

  // -- cancel-confirmation dialog --

  const dialogConfirmBtn = new Button('Yes, cancel', { variant: 'danger' });
  const dialogDismissBtn = new Button('Keep registration', { variant: 'secondary' });

  const cancelConfirmDialog = new Dialog({
    containerSelector: '#root',
    title: 'Cancel registration',
    content: new Text(
      'Are you sure you want to cancel your registration for this initiative? This cannot be undone.',
      { type: 'p', class: 'dialog-body-text' },
    ),
    footer: new Container(
      [dialogConfirmBtn, dialogDismissBtn],
      { class: 'modal-footer' },
    ),
    variant: 'warning',
  });

  dialogDismissBtn.onClickHandler = () => cancelConfirmDialog.close();

  dialogConfirmBtn.onClickHandler = async () => {
    if (!currentReg) {
      cancelConfirmDialog.close();
      return;
    }
    // Snapshot current reg in case it changes before async resolves.
    const reg = currentReg;
    dialogConfirmBtn.isLoading = true;
    const loading = Toast.loading('Cancelling registration...');
    try {
      await cancelRegistration(regList, reg.Id, reg['odata.etag']);
      currentReg = null;
      // Re-fetch accepted count for accuracy after freeing a slot.
      const freshCount = await countRegistrations(regList, id, REG_STATUSES.ACCEPTED);
      regCount = freshCount;
      loading.success('Registration cancelled.');
      cancelConfirmDialog.close();
      // After cancel: show form unless Auto mode and the initiative is full.
      // Validation mode never blocks applicants so always show the form.
      const nowFull =
        mode === REGISTRATION_MODES.AUTO &&
        freshCount !== Infinity &&
        isInitiativeFull(item.VolunteersNeeded, freshCount);
      modal.children = nowFull ? buildFullPanel() : buildFormPanel();
      registerBtn.children = 'Register';
    } catch (err) {
      console.error('[detail/cancel] cancelRegistration failed', { id, err });
      if (err && err.name === 'ConcurrencyConflict') {
        // Re-fetch so the next attempt uses the current etag.
        currentReg = await getUserRegistration(regList, id, email);
        loading.error('Registration state changed. Please close and try again.');
      } else {
        loading.error('Could not cancel registration. Please try again.');
      }
    } finally {
      dialogConfirmBtn.isLoading = false;
    }
  };

  // -- panel builders --

  const buildFormPanel = () => {
    const submitBtn = new Button('Register', { variant: 'primary' });
    const closeBtn = new Button('Close', { variant: 'secondary' });

    submitBtn.onClickHandler = async () => {
      submitBtn.isLoading = true;
      const loading = Toast.loading('Registering...');
      try {
        // Pre-check for a duplicate immediately before create to prevent
        // double-insertion from rapid clicks or concurrent tab submissions.
        const preCheck = await getUserRegistration(regList, id, email);
        if (preCheck) {
          Toast.info('You are already registered for this initiative.');
          currentReg = preCheck;
          loading.dismiss();
          modal.children = buildRegisteredPanel();
          registerBtn.children = 'Manage registration';
          return;
        }

        // Status depends on mode: Validation requires admin approval (Pending);
        // Auto mode accepts immediately.
        const regStatus =
          mode === REGISTRATION_MODES.VALIDATION
            ? REG_STATUSES.PENDING
            : REG_STATUSES.ACCEPTED;

        await createRegistration(regList, {
          initiativeId: id,
          initiativeTitle: title,
          email,
          name,
          transportNeeded: transportField.value,
          dietaryPreferences: extractComboBoxValue(dietField.value),
          notes: notesField.value,
          status: regStatus,
        });

        // Re-fetch to obtain the Id and etag needed for future cancellation.
        currentReg = await getUserRegistration(regList, id, email);

        // Only increment the accepted count for Auto mode; Pending registrations
        // do not count against the capacity cap.
        if (mode === REGISTRATION_MODES.AUTO) {
          regCount += 1;
        }

        const successMsg =
          mode === REGISTRATION_MODES.VALIDATION
            ? 'Registration submitted - pending approval.'
            : 'You are registered.';
        loading.success(successMsg);

        if (currentReg) {
          modal.children = buildRegisteredPanel();
        } else {
          // Unlikely: item created but immediate re-fetch failed.
          // Close the modal; user can re-open to manage.
          modal.close();
        }
        registerBtn.children = 'Manage registration';
      } catch (err) {
        console.error('[detail/register] createRegistration failed', { id, err });
        if (err && err.name === 'ConcurrencyConflict') {
          loading.error('Registration conflict. Please try again.');
        } else {
          loading.error('Could not register. Please try again.');
        }
      } finally {
        submitBtn.isLoading = false;
      }
    };

    closeBtn.onClickHandler = () => modal.close();

    return [
      new Text('Register for this initiative', { type: 'h2', class: 'modal-heading' }),
      new Text(
        `Registering as ${name} (${email})`,
        { type: 'p', class: 'modal-registering-as' },
      ),
      new Container(
        [
          new FieldLabel(
            'I need transportation arranged',
            new CheckBox(transportField, {}),
            { position: 'right', class: 'modal-transport-label' },
          ),
          new FieldLabel(
            'Dietary preferences',
            new ComboBox(dietField, dietOptions, {
              allowMultiple: true,
              allowFiltering: true,
              allowCreate: true,
              placeholder: 'Select or type preferences',
            }),
            { position: 'top', class: 'modal-field modal-field-combo' },
          ),
          new FieldLabel(
            'Notes',
            new TextArea(notesField, {
              placeholder: 'Anything else the organiser should know? (optional)',
              rows: 3,
            }),
            { position: 'top', class: 'modal-field' },
          ),
          new Container(
            [submitBtn, closeBtn],
            { class: 'modal-footer' },
          ),
        ],
        { class: 'modal-form' },
      ),
    ];
  };

  const buildRegisteredPanel = () => {
    // Heading and subtext adapt to the registration status so the volunteer
    // sees an accurate reflection of their state (Pending vs Accepted).
    const isPending = currentReg && String(currentReg.Status) === REG_STATUSES.PENDING;
    const headingText = isPending ? 'Registration pending approval' : 'You are registered';
    const subText = isPending
      ? `Application submitted as ${name} (${email})`
      : `Registered as ${name} (${email})`;

    const showTransport = currentReg && String(currentReg.TransportNeeded) === 'true';
    const dietaryRaw = currentReg ? currentReg.DietaryPreferences : null;
    const dietary = Array.isArray(dietaryRaw) ? dietaryRaw.join(', ') : str(dietaryRaw).trim();
    const notes = currentReg && str(currentReg.Notes).trim();

    const summaryItems = [
      new Container(
        [
          new Text('Transportation', { type: 'span', class: 'modal-reg-summary-label' }),
          new Text(
            showTransport ? 'Requested' : 'Not needed',
            { type: 'span', class: 'modal-reg-summary-value' },
          ),
        ],
        { class: 'modal-reg-summary-item' },
      ),
      isPending
        ? new Container(
            [
              new Text('Status', { type: 'span', class: 'modal-reg-summary-label' }),
              new Text('Pending approval', { type: 'span', class: 'modal-reg-summary-value' }),
            ],
            { class: 'modal-reg-summary-item' },
          )
        : null,
      dietary
        ? new Container(
            [
              new Text('Dietary preferences', { type: 'span', class: 'modal-reg-summary-label' }),
              new Text(dietary, { type: 'span', class: 'modal-reg-summary-value' }),
            ],
            { class: 'modal-reg-summary-item' },
          )
        : null,
      notes
        ? new Container(
            [
              new Text('Notes', { type: 'span', class: 'modal-reg-summary-label' }),
              new Text(notes, { type: 'span', class: 'modal-reg-summary-value' }),
            ],
            { class: 'modal-reg-summary-item' },
          )
        : null,
    ].filter(Boolean);

    const cancelRegBtn = new Button('Cancel registration', { variant: 'danger' });
    const closeBtn = new Button('Close', { variant: 'secondary' });

    cancelRegBtn.onClickHandler = () => {
      if (!cancelConfirmDialog.isAlive) cancelConfirmDialog.render();
      cancelConfirmDialog.open();
    };
    closeBtn.onClickHandler = () => modal.close();

    return [
      new Text(headingText, { type: 'h2', class: 'modal-heading' }),
      new Text(subText, { type: 'p', class: 'modal-registering-as' }),
      new Container(summaryItems, { class: 'modal-reg-summary' }),
      new Container(
        [cancelRegBtn, closeBtn],
        { class: 'modal-footer' },
      ),
    ];
  };

  const buildFullPanel = () => {
    const closeBtn = new Button('Close', { variant: 'secondary' });
    closeBtn.onClickHandler = () => modal.close();
    return [
      new Text('Initiative full', { type: 'h2', class: 'modal-heading' }),
      new Text(
        'All volunteer spots for this initiative have been filled. Check back later or explore other opportunities.',
        { type: 'p', class: 'modal-full-notice' },
      ),
      new Container([closeBtn], { class: 'modal-footer' }),
    ];
  };

  // -- open modal with the correct state --

  const openModal = () => {
    if (currentReg) {
      modal.children = buildRegisteredPanel();
    } else if (
      mode === REGISTRATION_MODES.AUTO &&
      isInitiativeFull(item.VolunteersNeeded, regCount)
    ) {
      // Capacity gate: only applies to Auto mode. Validation mode always
      // accepts new applicants (they become Pending).
      modal.children = buildFullPanel();
    } else {
      modal.children = buildFormPanel();
    }
    // First open mounts the modal into #root; the children setter refreshes it thereafter.
    if (!modal.isAlive) modal.render();
    modal.open();
  };

  // -- build hero --

  const tags = [];
  if (item.SDG1) tags.push(new Text(str(item.SDG1), { type: 'span', class: 'initiative-tag' }));
  if (item.SDG2) tags.push(new Text(str(item.SDG2), { type: 'span', class: 'initiative-tag' }));
  if (item.SDG3) tags.push(new Text(str(item.SDG3), { type: 'span', class: 'initiative-tag' }));

  const registerBtn = new Button(currentReg ? 'Manage registration' : 'Register', {
    variant: 'primary',
  });
  registerBtn.onClickHandler = () => openModal();

  const heroBand = new Container(
    [
      new Container(
        [
          new Text('Volunteer portal', { type: 'span', class: 'eyebrow' }),
          new Text(title, { type: 'h1', class: 'detail-hero-title' }),
          str(item.AssociationName)
            ? new Text(str(item.AssociationName), { type: 'p', class: 'detail-hero-association' })
            : null,
          new Container(
            [
              statusBadge(str(item.Status)),
              tags.length > 0 ? new Container(tags, { class: 'initiative-tags' }) : null,
            ].filter(Boolean),
            { class: 'detail-hero-meta' },
          ),
          registerBtn,
        ].filter(Boolean),
        { class: 'shell detail-hero-inner' },
      ),
    ],
    { class: 'detail-hero' },
  );

  // -- build body sections --

  const aboutSection = detailSection('About the association', [
    fieldRow('Association mission', item.AssociationMission),
    fieldRow('Website', item.AssociationWebsite),
    fieldRow('Point of contact', item.PointOfContact),
  ]);

  const missionSection = detailSection('Mission', [
    fieldRow('Mission name', item.MissionName),
    fieldRow('Description', item.MissionDescription),
    fieldRow('SDG (other)', item.SDGOther),
    fieldRow('Strategic priority', item.StrategicPriority),
    fieldRow('Location', item.MissionLocation),
    fieldRow('Transportation included', item.TransportationIncluded),
  ]);

  const skillsSection = detailSection('Skills and expectations', [
    fieldRow('Volunteer expectations', item.VolunteerExpectations),
    fieldRow('Physical / hands-on volunteering', item.PhysicalVolunteering),
    fieldRow('Skill 1', item.Skill1),
    fieldRow('Skill 2', item.Skill2),
    fieldRow('Skill 3', item.Skill3),
    fieldRow('Language requirements', item.LanguageRequirements),
    fieldRow('Skill dev 1', item.SkillDev1),
    fieldRow('Skill dev 2', item.SkillDev2),
    fieldRow('Skill dev 3', item.SkillDev3),
    fieldRow('Skill dev 4', item.SkillDev4),
  ]);

  const logisticsSection = detailSection('Logistics', [
    fieldRow('Duration', item.MissionDuration),
    fieldRow('Duration notes', item.DurationNotes),
    fieldRow('Planned days', item.PlannedDays),
    fieldRow('Starting time', item.StartingTime),
    fieldRow('Ending time', item.EndingTime),
    fieldRow('Volunteers needed', item.VolunteersNeeded),
    fieldRow('Hours per volunteer', item.HoursPerVolunteer),
    fieldRow('Registration deadline', formatDate(item.RegistrationDeadline)),
  ]);

  // -- testimonials section --

  const sampleTestimonials = [
    {
      quote: 'Taking part in this initiative gave me hands-on experience I could not have gained anywhere else. The team was welcoming and the impact felt real.',
      name: 'A. Martin',
      role: 'Volunteer, 2023',
    },
    {
      quote: 'I appreciated the clear structure and the support provided throughout the mission. It was well-organised and genuinely rewarding.',
      name: 'C. Dupont',
      role: 'Volunteer, 2023',
    },
    {
      quote: 'The skills I developed here have been directly useful in my day-to-day work. I would recommend this kind of engagement to any colleague.',
      name: 'R. Santos',
      role: 'Volunteer, 2024',
    },
  ];

  const testimonialCard = (t) =>
    new Container(
      [
        new Text(t.quote, { type: 'p', class: 'testimonial-quote' }),
        new Container(
          [
            new Text(t.name, { type: 'span', class: 'testimonial-name' }),
            new Text(t.role, { type: 'span', class: 'testimonial-role' }),
          ],
          { class: 'testimonial-attribution' },
        ),
      ],
      { class: 'testimonial-card surface' },
    );

  const testimonialsSection = new Container(
    [
      new Text('Testimonials', { type: 'h2', class: 'detail-section-title' }),
      new Text(
        'Sample testimonials shown as a preview. Actual volunteer testimonials will appear here once the feature is active.',
        { type: 'p', class: 'testimonials-notice' },
      ),
      new Container(
        sampleTestimonials.map(testimonialCard),
        { class: 'testimonials-grid' },
      ),
    ],
    { class: 'detail-section testimonials-section' },
  );

  const bodySections = [aboutSection, missionSection, skillsSection, logisticsSection, testimonialsSection].filter(Boolean);

  const body = new Container(
    [
      new Container(
        [
          new LinkButton('Back to initiatives', 'initiatives', { class: 'detail-back-link' }),
          ...bodySections,
        ],
        { class: 'detail-body shell' },
      ),
    ],
    { class: 'detail-body-band' },
  );

  return [
    buildNavbar(user, 'initiatives'),
    heroBand,
    body,
  ];
});
