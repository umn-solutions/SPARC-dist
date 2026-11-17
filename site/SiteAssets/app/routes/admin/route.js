import {
  defineRoute,
  Container,
  Card,
  Button,
  Text,
  TextInput,
  TextArea,
  FieldLabel,
  LinkButton,
  Toast,
  SiteApi,
  StyleResource,
  resolvePath,
  SystemError,
  View,
  Dialog,
  CurrentUser,
  ComboBox,
  FormField,
  extractComboBoxValue,
} from '../../libs/nofbiz/nofbiz.base.js';
import { loadFromFile } from '../../libs/nofbiz/nofbiz.excelparser.js';
import { TEMPLATE_FIELDS, SECTIONS, VALUE_COL, buildItemSchema } from './utils/templateMap.js';
import { readColumn, discoverSheetNames } from './utils/labelValueAdapter.js';
import { STATUSES, statusBadge } from '../../utils/status.js';
import { buildNavbar } from '../../utils/nav.js';
import {
  REG_STATUSES,
  REGISTRATION_MODES,
  getInitiativeRegistrations,
  acceptRegistration,
  cancelRegistration,
  countRegistrations,
} from '../../utils/registrations.js';

export default defineRoute(async (config) => {
  config.setRouteTitle('Admin');

  const routeStyles = new StyleResource(resolvePath('@/routes/admin/route.css'));
  await routeStyles.ready;

  const user = new CurrentUser();
  const TARGET_LIST = 'Initiatives';

  // -----------------------------------------------------------------------
  // IMPORT VIEW (existing mechanism, kept intact)
  // -----------------------------------------------------------------------

  // SP fields rendered as TextArea in preview (long text).
  const multilineFields = new Set([
    'AssociationMission',
    'MissionDescription',
    'VolunteerExpectations',
  ]);

  // Build item schema once; reused for every sheet in the import batch.
  const itemSchema = buildItemSchema();

  const importRoot = new Container([], { class: 'admin-import-root' });

  // Compute the Title field from assembled draft fields.
  const buildTitle = (draft) => {
    const assoc = String(draft.AssociationName ?? '').trim();
    const mission = String(draft.MissionName ?? '').trim();
    if (assoc && mission) return `${assoc} - ${mission}`;
    return assoc || mission || '(untitled)';
  };

  // Assemble a draft object for one sheet from its cell-address keyed Map.
  const assembleDraft = (cells) => {
    const draft = {};
    for (const field of TEMPLATE_FIELDS) {
      const value = cells.get(field.cell);
      draft[field.spField] = field.transform ? field.transform(value) : value;
    }
    return draft;
  };

  // Render a single field with label and disabled control.
  const buildField = (field, value, errorMessages) => {
    const stringValue =
      value === null || value === undefined ? '' : String(value);
    const control = multilineFields.has(field.spField)
      ? new TextArea(stringValue, { isDisabled: true, rows: 3, autoResize: true, resize: 'none' })
      : new TextInput(stringValue, { isDisabled: true });
    const fieldLabel = new FieldLabel(field.label, control, { position: 'top' });
    if (!errorMessages || errorMessages.length === 0) return fieldLabel;
    return new Container(
      [fieldLabel, new Text(errorMessages.join('; '), { class: 'admin-import-field-error' })],
      { class: 'admin-import-field' },
    );
  };

  // Render one section (group of related fields) inside a sheet card.
  const buildSection = (section, draft, errors) => {
    const fields = TEMPLATE_FIELDS.filter((f) => f.section === section.key);
    if (fields.length === 0) return null;
    const fieldNodes = fields.map((field) => {
      const fieldErrors = errors ? (errors[field.spField] ?? null) : null;
      const wide = multilineFields.has(field.spField);
      const node = buildField(field, draft[field.spField], fieldErrors);
      return new Container([node], {
        class: `admin-import-field${wide ? ' admin-import-field--wide' : ''}`,
      });
    });
    return new Container(
      [
        new Text(section.title, { type: 'h4', class: 'admin-import-section-title' }),
        new Container(fieldNodes, { class: 'admin-import-section-grid' }),
      ],
      { class: 'admin-import-section' },
    );
  };

  // Render one sheet card inside the preview section.
  const buildSheetCard = (sheetName, draft, ok, errors) => {
    const sectionNodes = SECTIONS.map((s) => buildSection(s, draft, errors)).filter(Boolean);
    const cardClass = ok
      ? 'admin-import-card admin-import-card--wide'
      : 'admin-import-card admin-import-card--wide admin-import-card--invalid';
    return new Card(
      [
        new Text(sheetName, { type: 'h3', class: 'admin-import-sheet-title' }),
        new Container(sectionNodes, { class: 'admin-import-sections' }),
      ],
      { class: cardClass },
    );
  };

  const renderInitial = () => {
    const importButton = new Button('Import', {
      variant: 'primary',
      onClickHandler: () => handleImportClick(importButton),
    });
    importRoot.children = new Card(
      [
        new Text('Import Initiatives', { type: 'h2' }),
        new Text('Select an Excel file to import sheets into the Initiatives list.', { type: 'p' }),
        new Container(
          [
            new LinkButton('View Initiatives', 'initiatives', { variant: 'secondary' }),
            importButton,
          ],
          { class: 'admin-import-actions' },
        ),
      ],
      { class: 'admin-import-card' },
    );
  };

  // Render a fallback UI for manual sheet name entry when auto-discovery finds zero sheets.
  const renderSheetFallback = (buffer) => {
    const sheetInput = new TextInput('', {
      placeholder: 'Sheet1, Sheet2',
      class: 'admin-import-sheet-input',
    });
    const continueButton = new Button('Continue', {
      variant: 'primary',
      onClickHandler: () => handleManualSheets(buffer, sheetInput, continueButton),
    });
    importRoot.children = new Card(
      [
        new Text('Sheet names not detected', { type: 'h2' }),
        new Text(
          'No sheets were auto-detected. Enter sheet names separated by commas.',
          { type: 'p' },
        ),
        new FieldLabel('Sheet names', sheetInput, { position: 'top' }),
        new Container(
          [
            new Button('Cancel', { variant: 'secondary', onClickHandler: renderInitial }),
            continueButton,
          ],
          { class: 'admin-import-actions' },
        ),
      ],
      { class: 'admin-import-card' },
    );
  };

  const renderPreview = (parsedSheets) => {
    const confirmButton = new Button('Confirm', {
      variant: 'primary',
      onClickHandler: () => handleConfirm(parsedSheets, confirmButton),
    });
    const validCount = parsedSheets.filter((s) => s.ok).length;
    const sheetCards = parsedSheets.map((s) =>
      buildSheetCard(s.sheetName, s.draft, s.ok, s.errors),
    );
    importRoot.children = new Card(
      [
        new Text(
          `Preview (${parsedSheets.length} ${parsedSheets.length === 1 ? 'sheet' : 'sheets'}, ${validCount} valid)`,
          { type: 'h2' },
        ),
        new Container(sheetCards, { class: 'admin-import-preview' }),
        new Container(
          [
            new Button('Cancel', { variant: 'secondary', onClickHandler: renderInitial }),
            confirmButton,
          ],
          { class: 'admin-import-actions' },
        ),
      ],
      { class: 'admin-import-card admin-import-card--wide' },
    );
  };

  // Process an array of sheet names against the buffer and render preview.
  const processSheets = async (buffer, sheetNames) => {
    const loading = Toast.loading('Reading sheets...');
    const parsedSheets = [];
    for (const sheetName of sheetNames) {
      let cells;
      try {
        cells = await readColumn(buffer, sheetName, VALUE_COL);
      } catch (err) {
        console.error(`[admin/import] readColumn failed for sheet "${sheetName}":`, err);
        Toast.error(err && err.message ? err.message : `Failed to read sheet "${sheetName}".`);
        continue;
      }
      const draft = assembleDraft(cells);
      const parsed = itemSchema.safeParse(draft);
      parsedSheets.push({
        sheetName,
        draft: { Title: buildTitle(draft), ...draft },
        ok: parsed.success,
        errors: parsed.success ? null : parsed.error.flatten().fieldErrors,
      });
    }
    if (parsedSheets.length === 0) {
      Toast.warning('No sheets could be read from the file.');
      loading.dismiss();
      renderInitial();
      return;
    }
    loading.success(`Parsed ${parsedSheets.length} ${parsedSheets.length === 1 ? 'sheet' : 'sheets'}.`);
    renderPreview(parsedSheets);
  };

  const handleImportClick = async (importButton) => {
    importButton.isLoading = true;
    try {
      const result = await loadFromFile({ accept: '.xlsx,.xls' });
      const buffer = await result.file.arrayBuffer();
      const sheetNames = await discoverSheetNames(buffer);
      if (sheetNames.length === 0) {
        renderSheetFallback(buffer);
        return;
      }
      await processSheets(buffer, sheetNames);
    } catch (err) {
      console.error('[admin/import] handleImportClick failed:', err);
      if (err && err.message) Toast.error(err.message);
    } finally {
      importButton.isLoading = false;
    }
  };

  const handleManualSheets = async (buffer, sheetInput, continueButton) => {
    const raw = sheetInput.value ?? '';
    const sheetNames = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (sheetNames.length === 0) {
      Toast.error('Enter at least one sheet name.');
      return;
    }
    continueButton.isLoading = true;
    try {
      await processSheets(buffer, sheetNames);
    } finally {
      continueButton.isLoading = false;
    }
  };

  const handleConfirm = async (parsedSheets, confirmButton) => {
    const validSheets = parsedSheets.filter((s) => s.ok);
    if (validSheets.length === 0) {
      Toast.error('No valid sheets to import.');
      return;
    }
    confirmButton.isLoading = true;
    const list = new SiteApi().list(TARGET_LIST);
    const task = (async () => {
      let ok = 0;
      let failed = 0;
      for (const sheet of validSheets) {
        const payload = Object.fromEntries(
          Object.entries({ ...sheet.draft, Status: STATUSES.OPEN }).filter(
            ([, v]) => v !== undefined && v !== null && v !== '',
          ),
        );
        try {
          await list.createItem(payload);
          ok++;
        } catch (err) {
          console.error(`[admin/import] createItem failed for sheet "${sheet.sheetName}":`, err, 'payload:', payload);
          failed++;
        }
      }
      if (failed > 0) {
        throw new SystemError(
          'ImportPartialFailure',
          `Imported ${ok} of ${validSheets.length}. ${failed} failed.`,
          { breaksFlow: false },
        );
      }
      return ok;
    })();

    try {
      await Toast.promise(task, {
        loading: `Importing ${validSheets.length} ${validSheets.length === 1 ? 'sheet' : 'sheets'}...`,
        success: (n) => `Imported ${n} ${n === 1 ? 'initiative' : 'initiatives'}.`,
        error: (e) => (e && e.message) || 'Import failed.',
      });
    } catch (err) {
      console.error('[admin/import] confirm batch failed:', err);
    } finally {
      confirmButton.isLoading = false;
    }
    renderInitial();
  };

  renderInitial();

  // -----------------------------------------------------------------------
  // MANAGE VIEW
  // -----------------------------------------------------------------------

  const manageRoot = new Container([], { class: 'manage-root' });

  // Route-scope initiatives list instance -- reused by both loadAndRenderManage
  // and openRegistrations (for settings updates).
  const initiativesList = new SiteApi().list(TARGET_LIST);

  // Builds the manage table from a fresh list load.
  const loadAndRenderManage = async () => {
    let items;
    try {
      items = await initiativesList.getItems();
    } catch (err) {
      console.error('[admin/manage] getItems failed:', err);
      Toast.error(err && err.message ? err.message : 'Failed to load initiatives.');
      manageRoot.children = new Text('Failed to load initiatives.', { type: 'p' });
      return;
    }

    if (items.length === 0) {
      manageRoot.children = new Container(
        [new Text('No initiatives found. Import some first.', { type: 'p', class: 'empty-state-hint' })],
        { class: 'empty-state' },
      );
      return;
    }

    const rows = items.map((item) => buildManageRow(item, initiativesList, reload));
    const table = new Container(
      [
        new Container(
          [
            new Text('Title', { type: 'span', class: 'manage-col-header' }),
            new Text('Association', { type: 'span', class: 'manage-col-header' }),
            new Text('Status', { type: 'span', class: 'manage-col-header' }),
            new Text('Actions', { type: 'span', class: 'manage-col-header' }),
          ],
          { class: 'manage-row manage-row--header' },
        ),
        ...rows,
      ],
      { class: 'manage-table' },
    );

    manageRoot.children = table;
  };

  const reload = loadAndRenderManage;

  // Single Registrations list instance -- reused by openRegistrations on every click.
  const registrationsList = new SiteApi().list('Registrations');

  // Opens a management Dialog for the given initiative. The body is re-rendered
  // after every mutation without closing the dialog.
  const openRegistrations = async (item) => {
    const initiativeId = item.Id ?? item.ID;

    // Settings FormFields -- created once per panel session, persist across re-renders
    // so the user's in-progress edits survive re-renders triggered by list mutations.
    const modeOptions = [
      { label: 'Auto accept', value: REGISTRATION_MODES.AUTO },
      { label: 'Validation step', value: REGISTRATION_MODES.VALIDATION },
    ];
    const currentModeStr = String(item.RegistrationMode || REGISTRATION_MODES.AUTO);
    const initialModeOption =
      modeOptions.find((o) => o.value === currentModeStr) || modeOptions[0];
    const modeField = new FormField({ value: initialModeOption });
    const maxField = new FormField({ value: String(item.VolunteersNeeded || '') });
    const searchField = new FormField({ value: '' });

    // Stable container for the volunteer list -- its children are replaced by
    // renderList without recreating the Container itself. Lives in panelBody
    // permanently so the search input above it never loses focus during typing.
    const listContainer = new Container([], { class: 'reg-list-wrap' });

    // Full registration data from the last network fetch. renderList reads this
    // without triggering another network call.
    let loadedRegs = [];

    // Container whose children are replaced on every render -- the Dialog stays open.
    const panelBody = new Container([], { class: 'reg-panel-body' });

    // Pure DOM render: filters loadedRegs by search term, applies pending-first
    // sort for Validation mode, builds rows, and updates listContainer.children.
    // No network calls -- safe to call on every keystroke.
    const renderList = () => {
      const term = String(searchField.value || '').trim().toLowerCase();
      const filtered = term
        ? loadedRegs.filter((reg) => String(reg.UserName || '').toLowerCase().includes(term))
        : loadedRegs;

      const currentMode = extractComboBoxValue(modeField.value) || REGISTRATION_MODES.AUTO;
      const sortedFiltered =
        currentMode === REGISTRATION_MODES.VALIDATION
          ? [...filtered].sort((a, b) => {
              const aPending = String(a.Status) === REG_STATUSES.PENDING ? -1 : 1;
              const bPending = String(b.Status) === REG_STATUSES.PENDING ? -1 : 1;
              return aPending - bPending;
            })
          : filtered;

      if (loadedRegs.length === 0) {
        listContainer.children = new Text(
          'No volunteers have registered yet.',
          { type: 'p', class: 'empty-state-hint' },
        );
        return;
      }

      if (sortedFiltered.length === 0) {
        listContainer.children = new Text(
          'No volunteers match that name.',
          { type: 'p', class: 'empty-state-hint' },
        );
        return;
      }

      const regRows = sortedFiltered.map((reg) => {
        const regName = String(reg.UserName || reg.UserEmail || '');
        const regEmail = String(reg.UserEmail || '');
        const transport = String(reg.TransportNeeded) === 'true' ? 'Yes' : 'No';
        const dietary = String(reg.DietaryPreferences || '');
        const notes = String(reg.Notes || '');
        const regStatus = String(reg.Status || '');

        const infoChildren = [
          new Text(regName, { type: 'span', class: 'reg-name' }),
          new Text(regEmail, { type: 'span', class: 'reg-email' }),
          new Text(`Transport: ${transport}`, { type: 'span', class: 'reg-meta' }),
        ];
        if (dietary) {
          infoChildren.push(new Text(`Dietary: ${dietary}`, { type: 'span', class: 'reg-meta' }));
        }
        if (notes) {
          infoChildren.push(new Text(`Notes: ${notes}`, { type: 'span', class: 'reg-meta' }));
        }

        const statusEl = statusBadge(regStatus);

        // Action buttons depend on status.
        const actionBtns = [];

        if (regStatus === REG_STATUSES.PENDING) {
          const approveBtn = new Button('Approve', { variant: 'primary' });
          approveBtn.onClickHandler = async () => {
            // Cap enforcement uses loadedRegs (the full persisted set), not the
            // filtered subset currently visible.
            const currentAccepted = loadedRegs.filter(
              (r) => String(r.Status) === REG_STATUSES.ACCEPTED,
            ).length;
            const currentMax = parseInt(item.VolunteersNeeded, 10);
            if (Number.isFinite(currentMax) && currentMax > 0 && currentAccepted >= currentMax) {
              Toast.warning('Maximum accepted volunteers reached.');
              return;
            }

            approveBtn.isLoading = true;
            const loading = Toast.loading('Approving...');
            try {
              await acceptRegistration(registrationsList, reg.Id, reg['odata.etag']);
              loading.success('Volunteer approved.');
              await renderPanelBody();
            } catch (err) {
              console.error('[admin/openRegistrations] acceptRegistration failed', { regId: reg.Id, err });
              if (err && err.name === 'ConcurrencyConflict') {
                loading.error('Registration changed elsewhere. Refreshing...');
                await renderPanelBody();
              } else {
                loading.error('Could not approve. Please try again.');
              }
            } finally {
              if (approveBtn.isAlive) approveBtn.isLoading = false;
            }
          };

          const rejectBtn = new Button('Reject', { variant: 'danger' });
          rejectBtn.onClickHandler = async () => {
            rejectBtn.isLoading = true;
            const loading = Toast.loading('Rejecting...');
            try {
              await cancelRegistration(registrationsList, reg.Id, reg['odata.etag']);
              loading.success('Registration rejected.');
              await renderPanelBody();
            } catch (err) {
              console.error('[admin/openRegistrations] rejectRegistration failed', { regId: reg.Id, err });
              if (err && err.name === 'ConcurrencyConflict') {
                loading.error('Registration changed elsewhere. Refreshing...');
                await renderPanelBody();
              } else {
                loading.error('Could not reject. Please try again.');
              }
            } finally {
              if (rejectBtn.isAlive) rejectBtn.isLoading = false;
            }
          };

          actionBtns.push(approveBtn, rejectBtn);
        } else if (regStatus === REG_STATUSES.ACCEPTED) {
          const removeBtn = new Button('Remove', { variant: 'danger' });
          removeBtn.onClickHandler = async () => {
            removeBtn.isLoading = true;
            const loading = Toast.loading('Removing...');
            try {
              await cancelRegistration(registrationsList, reg.Id, reg['odata.etag']);
              loading.success('Volunteer removed.');
              await renderPanelBody();
            } catch (err) {
              console.error('[admin/openRegistrations] removeRegistration failed', { regId: reg.Id, err });
              if (err && err.name === 'ConcurrencyConflict') {
                loading.error('Registration changed elsewhere. Refreshing...');
                await renderPanelBody();
              } else {
                loading.error('Could not remove. Please try again.');
              }
            } finally {
              if (removeBtn.isAlive) removeBtn.isLoading = false;
            }
          };

          actionBtns.push(removeBtn);
        }

        return new Container(
          [
            new Container(infoChildren, { class: 'reg-row-info' }),
            statusEl,
            new Container(actionBtns, { class: 'reg-row-actions' }),
          ],
          { class: 'reg-row' },
        );
      });

      listContainer.children = regRows;
    };

    // Single subscription: fires only on user input, calls renderList (no network).
    // Declared after renderList to avoid temporal-dead-zone access.
    searchField.subscribe(() => renderList());

    // Fetches registrations, stores the full set in loadedRegs, rebuilds the
    // settings row and summary line (from the full set), adds the search box,
    // then delegates list rendering to renderList.
    const renderPanelBody = async () => {
      loadedRegs = await getInitiativeRegistrations(registrationsList, initiativeId);

      const currentMode = extractComboBoxValue(modeField.value) || REGISTRATION_MODES.AUTO;

      // Derive counts from the FULL loaded set -- unaffected by the search filter.
      const acceptedCount = loadedRegs.filter((r) => String(r.Status) === REG_STATUSES.ACCEPTED).length;
      const pendingCount = loadedRegs.filter((r) => String(r.Status) === REG_STATUSES.PENDING).length;
      const maxVal = parseInt(item.VolunteersNeeded, 10);
      const maxDisplay = Number.isFinite(maxVal) && maxVal > 0 ? maxVal : '-';

      // ---- SETTINGS ROW ----
      const modeCombo = new ComboBox(modeField, modeOptions, {});
      const maxInput = new TextInput(maxField, { placeholder: 'e.g. 25' });
      const saveBtn = new Button('Save settings', { variant: 'primary' });

      saveBtn.onClickHandler = async () => {
        const rawMax = maxField.value;
        const parsedMax = parseInt(rawMax, 10);
        if (!Number.isFinite(parsedMax) || parsedMax < 0) {
          Toast.error('Maximum must be a non-negative integer.');
          return;
        }
        const newMode = extractComboBoxValue(modeField.value) || REGISTRATION_MODES.AUTO;

        saveBtn.isLoading = true;
        const loading = Toast.loading('Saving settings...');
        try {
          await initiativesList.updateItem(
            initiativeId,
            { RegistrationMode: newMode, VolunteersNeeded: String(parsedMax) },
            item['odata.etag'],
          );
          // Update local fields so subsequent panel interactions reflect the change.
          // Note: item['odata.etag'] is now stale. A second save in the same panel
          // session will receive a ConcurrencyConflict (412), handled below.
          item.RegistrationMode = newMode;
          item.VolunteersNeeded = String(parsedMax);
          loading.success('Settings saved.');
          // Reload the manage table so the table row shows the new values and
          // carries a fresh etag for future updates after reopening.
          await reload();
          await renderPanelBody();
        } catch (err) {
          console.error('[admin/openRegistrations] updateItem (settings) failed', { initiativeId, err });
          if (err && err.name === 'ConcurrencyConflict') {
            loading.error('Settings changed elsewhere. Close and reopen the panel to retry.');
          } else {
            loading.error('Could not save settings. Please try again.');
          }
        } finally {
          if (saveBtn.isAlive) saveBtn.isLoading = false;
        }
      };

      const settingsRow = new Container(
        [modeCombo, maxInput, saveBtn],
        { class: 'reg-settings-row' },
      );

      // ---- SUMMARY LINE ----
      const summaryText =
        currentMode === REGISTRATION_MODES.VALIDATION
          ? `Accepted ${acceptedCount} / Max ${maxDisplay}  |  Pending ${pendingCount}`
          : `Accepted ${acceptedCount} / Max ${maxDisplay}`;
      const summaryLine = new Text(summaryText, { type: 'p', class: 'reg-summary-line' });

      // ---- SEARCH BOX ----
      // Binds to the session-scoped searchField so the current term survives
      // mutation-triggered re-renders of renderPanelBody.
      const searchInput = new TextInput(searchField, { placeholder: 'Search by name...', debounceMs: 200 });
      const searchBox = new Container([searchInput], { class: 'reg-search' });

      panelBody.children = [settingsRow, summaryLine, searchBox, listContainer];
      renderList();
    };

    // ---- DIALOG ----
    const closeBtn = new Button('Close', {
      variant: 'secondary',
      onClickHandler: () => dlg.close(),
    });

    const dlg = new Dialog({
      variant: 'info',
      title: `Manage Registrations - ${String(item.Title || '')}`,
      content: panelBody,
      footer: new Container([closeBtn], { class: 'manage-dialog-footer' }),
      containerSelector: '#root',
    });

    dlg.render();

    // First load: show a loading toast while fetching registrations.
    const loading = Toast.loading('Loading registrations...');
    try {
      await renderPanelBody();
    } finally {
      loading.dismiss();
    }

    dlg.open();
  };

  // Builds one row for the manage table. Actions depend on the item's Status.
  const buildManageRow = (item, list, onMutated) => {
    const status = String(item.Status || '');
    const etag = item['odata.etag'];

    const actionButtons = [];

    if (status === STATUSES.OPEN) {
      const cancelBtn = new Button('Cancel', {
        variant: 'secondary',
        onClickHandler: async () => {
          cancelBtn.isLoading = true;
          const loading = Toast.loading('Cancelling...');
          try {
            await list.updateItem(item.ID, { Status: STATUSES.CANCELLED }, etag);
            loading.success('Initiative cancelled.');
            await onMutated();
          } catch (err) {
            console.error('[admin/manage] cancel failed:', err, 'item:', item.ID);
            loading.error(err && err.message ? err.message : 'Failed to cancel initiative.');
          } finally {
            cancelBtn.isLoading = false;
          }
        },
      });

      const closeBtn = new Button('Close', {
        variant: 'secondary',
        onClickHandler: async () => {
          closeBtn.isLoading = true;
          const loading = Toast.loading('Closing...');
          try {
            await list.updateItem(item.ID, { Status: STATUSES.CLOSED }, etag);
            loading.success('Initiative closed.');
            await onMutated();
          } catch (err) {
            console.error('[admin/manage] close failed:', err, 'item:', item.ID);
            loading.error(err && err.message ? err.message : 'Failed to close initiative.');
          } finally {
            closeBtn.isLoading = false;
          }
        },
      });

      actionButtons.push(cancelBtn, closeBtn);
    } else {
      // Cancelled or Closed: show Delete with confirmation dialog.
      const deleteBtn = new Button('Delete', {
        variant: 'danger',
        onClickHandler: () => {
          const confirmBtn = new Button('Confirm delete', {
            variant: 'danger',
            onClickHandler: async () => {
              confirmBtn.isLoading = true;
              const loading = Toast.loading('Deleting...');
              try {
                await list.deleteItem(item.ID, etag);
                confirmDialog.close();
                loading.success('Initiative deleted.');
                await onMutated();
              } catch (err) {
                console.error('[admin/manage] delete failed:', err, 'item:', item.ID);
                loading.error(err && err.message ? err.message : 'Failed to delete initiative.');
              } finally {
                confirmBtn.isLoading = false;
              }
            },
          });

          const cancelDialogBtn = new Button('Cancel', {
            variant: 'secondary',
            onClickHandler: () => confirmDialog.close(),
          });

          const confirmDialog = new Dialog({
            variant: 'error',
            title: 'Delete initiative',
            content: new Text(
              `Delete "${String(item.Title || '')}"? This action cannot be undone.`,
              { type: 'p' },
            ),
            footer: new Container([cancelDialogBtn, confirmBtn], { class: 'manage-dialog-footer' }),
          });

          confirmDialog.render();
          confirmDialog.open();
        },
      });

      actionButtons.push(deleteBtn);
    }

    const titleBtn = new Button(String(item.Title || ''), {
      variant: 'secondary',
      class: 'manage-title-btn',
      onClickHandler: () => openRegistrations(item),
    });

    return new Container(
      [
        new Container([titleBtn], { class: 'manage-cell manage-cell--title' }),
        new Text(String(item.AssociationName || ''), { type: 'span', class: 'manage-cell' }),
        new Container([statusBadge(status)], { class: 'manage-cell' }),
        new Container(actionButtons, { class: 'manage-actions' }),
      ],
      { class: 'manage-row' },
    );
  };

  // Initial load
  await loadAndRenderManage();

  // Refresh button -- lives in the rail actions area.
  const refreshBtn = new Button('Refresh', {
    variant: 'secondary',
    class: 'admin-rail__item',
    onClickHandler: async () => {
      refreshBtn.isLoading = true;
      const loading = Toast.loading('Refreshing...');
      try {
        await loadAndRenderManage();
        loading.success('List refreshed.');
      } catch (err) {
        console.error('[admin/manage] refresh failed:', err);
        loading.error(err && err.message ? err.message : 'Refresh failed.');
      } finally {
        refreshBtn.isLoading = false;
      }
    },
  });

  // -----------------------------------------------------------------------
  // WORKSPACE -- Views + Vertical Rail
  // -----------------------------------------------------------------------

  const importView = new View(importRoot, { showOnRender: false });
  const manageView = new View(manageRoot, { showOnRender: true });

  let activeSection = 'manage';

  // Builds the two section nav items with the correct active class applied.
  // Re-called on each section switch to update the active state visually.
  // switchSection is referenced in the click handlers via closure; it is
  // defined after this function and after railSectionsGroup, but is always
  // resolved before any user click fires.
  const buildRailSectionItems = (active) => [
    new Button('Manage', {
      variant: 'secondary',
      class: `admin-rail__item${active === 'manage' ? ' admin-rail__item--active' : ''}`,
      onClickHandler: () => switchSection('manage'),
    }),
    new Button('Import', {
      variant: 'secondary',
      class: `admin-rail__item${active === 'import' ? ' admin-rail__item--active' : ''}`,
      onClickHandler: () => switchSection('import'),
    }),
    new Button('Volunteering Hours', {
      variant: 'secondary',
      class: 'admin-rail__item',
      isDisabled: true,
      onClickHandler: () => {},
    }),
  ];

  const railSectionsGroup = new Container(
    buildRailSectionItems(activeSection),
    { class: 'admin-rail__sections' },
  );

  const switchSection = (section) => {
    activeSection = section;
    railSectionsGroup.children = buildRailSectionItems(activeSection);
    if (section === 'import') {
      importView.show();
      manageView.hide();
    } else {
      manageView.show();
      importView.hide();
      loadAndRenderManage();
    }
  };

  const railDivider = new Container([], { class: 'admin-rail__divider' });
  const railActionsGroup = new Container([refreshBtn], { class: 'admin-rail__actions' });

  const rail = new Container(
    [railSectionsGroup, railDivider, railActionsGroup],
    { class: 'admin-rail' },
  );

  const contentArea = new Container(
    [importView, manageView],
    { class: 'admin-workspace__content' },
  );

  // -----------------------------------------------------------------------
  // PAGE STRUCTURE
  // -----------------------------------------------------------------------

  const adminHeader = new Container(
    [
      new Container(
        [
          new Text('Admin', { type: 'span', class: 'eyebrow' }),
          new Text('Manage portal', { type: 'h1', class: 'section-title' }),
        ],
        { class: 'shell' },
      ),
    ],
    { class: 'admin-header-band' },
  );

  const workspace = new Container(
    [new Container([rail, contentArea], { class: 'admin-workspace shell' })],
    { class: 'admin-workspace-band' },
  );

  return [
    buildNavbar(user, 'admin'),
    adminHeader,
    workspace,
  ];
});
