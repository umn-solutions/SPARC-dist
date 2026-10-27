import {
  Container,
  Text,
  TextArea,
  NumberInput,
  ComboBox,
  FormField,
  FormSchema,
  FieldLabel,
  Button,
  TabGroup,
  View,
  SystemError,
  extractComboBoxValue,
  __zod,
} from '../libs/nofbiz/nofbiz.base.js';

import {
  ANNUALIZATION_FACTORS,
  FTE_MINUTES_PER_YEAR,
  SOFT_CATEGORIES,
  CATEGORY_KEYS,
  CATEGORY_LABELS,
  METRIC_DESCRIPTIONS,
  CATEGORY_DIRECTIONS,
  CATEGORY_FIELD_NAMES,
  INPUT_KEYS_BY_CATEGORY,
  INPUT_LABELS_BY_CATEGORY,
  SOFT_SAVINGS_THRESHOLD_EUR,
  MENTOR_MANAGER_LABELS,
  FINANCE_VALIDATION_NOTICE,
  inferCategoriesFromMetrics,
  inferSavingTypeFromMetrics,
  formatSavingTypeShort,
  metricsHaveFinancialData,
} from './constants.js';

import { createSegmentedToggle } from './tags-toggle.js';

import { STATUS } from './status-helpers.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Label constants -- still useful in display code. */
export const FINANCIAL_TYPES = {
  EFICIENCIA: 'Eficiencia',
  PRODUCAO:   'Producao',
  GASTOS_GERAIS: 'GastosGerais',
};

/** Per-input unit suffix. Empty string = no unit (raw counts/volumes). */
const INPUT_UNITS_BY_CATEGORY = {
  eficiencia:    { vp: '',  tu: 'min' },
  producao:      { vp: '',  mu: '€' },
  gastos:        { v:  '',  c:  '€' },
  reducao_risco: { exp: '€', taxa: '%' },
  reducao_custo: { co: '€' },
};

/** Per-category total unit. */
const CATEGORY_TOTAL_UNIT = {
  eficiencia:    'min',
  producao:      '€',
  gastos:        '€',
  reducao_risco: '€',
  reducao_custo: '€',
};

/**
 * Categories that carry a mode toggle.
 * Each entry defines the default option value, the available options, and a label.
 */
const CATEGORY_MODE_CONFIG = {
  reducao_custo: {
    label: 'Tipo',
    default: 'custo',
    options: [
      { label: 'Custo evitado', value: 'custo' },
      { label: 'Risco evitado', value: 'risco' },
    ],
  },
};

// ---------------------------------------------------------------------------
// Shared display helpers (exported -- reused by consumers)
// ---------------------------------------------------------------------------

/**
 * Formats a value for display. Returns '-' for empty/null values,
 * locale-formatted number for numeric values, or the raw string.
 * @param {*} val
 * @returns {string}
 */
export function displayValue(val) {
  if (val === null || val === undefined || val === '') return '-';
  const n = parseFloat(val);
  if (isNaN(n)) return String(val);
  return n.toLocaleString('pt-PT');
}

/**
 * Like displayValue, but appends a unit suffix (with leading space) when both
 * the value renders as something other than '-' and a non-empty unit is provided.
 * @param {*} val
 * @param {string} unit
 * @returns {string}
 */
export function displayValueWithUnit(val, unit) {
  const formatted = displayValue(val);
  if (formatted === '-' || !unit) return formatted;
  return formatted + ' ' + unit;
}

/**
 * Parses an existing stored value back to a number suitable for a NumberInput,
 * or returns empty string if not parseable.
 * @param {*} val
 * @returns {number|string}
 */
export function parseInitial(val) {
  if (val === null || val === undefined || val === '') return '';
  const n = parseFloat(val);
  return isNaN(n) ? '' : n;
}

/**
 * Wraps a FieldLabel around a label string and an input component.
 * @param {string} label
 * @param {import('../libs/nofbiz/nofbiz.base.js').HTMDElement} input
 * @returns {FieldLabel}
 */
export function buildEditableRow(label, input) {
  return new FieldLabel(label, input);
}

/**
 * Builds a read-only display row with a label and a value component.
 * @param {string} label
 * @param {import('../libs/nofbiz/nofbiz.base.js').HTMDElement|string} valueComponent
 * @param {string} [extraClass] - Optional modifier class (e.g. 'pace-detail-row--total')
 * @returns {Container}
 */
export function buildReadOnlyRow(label, valueComponent, extraClass) {
  const cls = extraClass ? `pace-detail-row ${extraClass}` : 'pace-detail-row';
  return new Container([
    new Text(label, { type: 'span', class: 'pace-detail-label' }),
    valueComponent,
  ], { class: cls });
}

/**
 * Returns the annualization factor for a given time period string,
 * or 0 if the period is not recognized.
 * @param {string} timePeriod
 * @returns {number}
 */
export function getAnnualizationFactor(timePeriod) {
  return ANNUALIZATION_FACTORS[timePeriod] || 0;
}

/**
 * Formats a decimal FTE value with 2 decimal places.
 * @param {number} val
 * @returns {string}
 */
export function formatFte(val) {
  if (!val || isNaN(val)) return '0,00';
  return val.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Formats a € monetary value with 3 decimal places.
 * @param {number} val
 * @returns {string}
 */
export function formatEur(val) {
  if (!val || isNaN(val)) return '0,000 €';
  return val.toLocaleString('pt-PT', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' €';
}

/**
 * Converts an annualized eficiencia figure in MINUTES to euros via the FTE annual cost.
 * Single source of truth shared by the export and the IMPLEMENTED email.
 * @param {number|string} annualMinutes - annualized minutes saved
 * @param {number|string} fteAnnualCost - FTEAnnualCost (€/FTE/year)
 * @returns {number} euros
 */
export function eficienciaMinutesToEur(annualMinutes, fteAnnualCost) {
  const min = parseFloat(annualMinutes) || 0;
  const cost = parseFloat(fteAnnualCost) || 0;
  return FTE_MINUTES_PER_YEAR ? (min / FTE_MINUTES_PER_YEAR) * cost : 0;
}

/**
 * Extracts the plain string value from a ComboBox FormField.
 * Handles both { label, value } objects and plain strings.
 * @param {FormField} field
 * @returns {string}
 */
export function extractComboValue(field) {
  const val = field.value;
  if (val && typeof val === 'object' && !Array.isArray(val)) return String(val.value || '');
  return String(val || '');
}

/**
 * Extracts an array of label strings from a multi-select ComboBox FormField.
 * @param {FormField} field
 * @returns {string[]}
 */
export function extractCategoryLabels(field) {
  const val = field.value;
  if (!val) return [];
  const arr = Array.isArray(val) ? val : [val];
  return arr.map(item => {
    if (item && typeof item === 'object') return item.label || item.value || '';
    return String(item || '');
  }).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Simulador Financeiro helpers
// ---------------------------------------------------------------------------

/**
 * Internal: resolves a raw simulador value to { active, value }.
 * "Active" means the value is non-empty, non-null, and parses to a finite number (0 included).
 * Only empty string / null / undefined / non-numeric (NaN/Infinity) are INACTIVE.
 * A typed 0 and a cleared (empty-string) field are distinguishable: NumberInput early-returns on
 * an empty raw value and leaves the FormField as '', so '' stays inactive while a typed 0 is active.
 * @param {*} rawVal
 * @returns {{ active: boolean, value: number }}
 */
function resolveSimulador(rawVal) {
  if (rawVal === null || rawVal === undefined || rawVal === '') return { active: false, value: 0 };
  const n = parseFloat(rawVal);
  if (!isFinite(n)) return { active: false, value: 0 };
  return { active: true, value: n };
}

/**
 * Reads the simulador override from a raw producao payload object.
 * Use this for plain-JSON reads (e.g. from SP list data or export).
 * @param {Object|null|undefined} payload
 * @returns {{ active: boolean, value: number }}
 */
export function getSimuladorFromPayload(payload) {
  return resolveSimulador(payload && payload.simulador);
}

// ---------------------------------------------------------------------------
// Internal numeric helper
// ---------------------------------------------------------------------------

/** Coerces any value to a float, returning 0 for invalid input. */
function num(v) {
  return parseFloat(v) || 0;
}

// ---------------------------------------------------------------------------
// Per-category total formula
// ---------------------------------------------------------------------------

/**
 * Computes the raw period total for a single phase object belonging to a category.
 * @param {string} key - Category key ('eficiencia'|'producao'|'gastos')
 * @param {Object} phase - Phase object with FormField values (asIs/toBe sub-object)
 * @returns {number}
 */
function computePhaseTotal(key, phase) {
  if (key === 'eficiencia')    return num(phase.vp.value) * num(phase.tu.value);
  if (key === 'producao')      return num(phase.vp.value) * num(phase.mu.value);
  if (key === 'gastos')        return num(phase.v.value) * num(phase.c.value);
  if (key === 'reducao_risco') return num(phase.exp.value) * num(phase.taxa.value) / 100;
  if (key === 'reducao_custo') return num(phase.co.value);
  return 0;
}

// ---------------------------------------------------------------------------
// Lifecycle authority
// ---------------------------------------------------------------------------

/**
 * Single source of truth for which phases are editable at each initiative status.
 * Both asIs and toBe are editable across all non-locked statuses for users with
 * write access. Metric completeness is enforced at the mentor validation step
 * (mentorSavingsValidation), so EM_VALIDACAO_MENTOR must stay editable -- the mentor
 * fills/corrects every selected metric's fields before advancing to the gestor.
 * Once past the mentor stage (EM_VALIDACAO_GESTOR / EM_VALIDACAO_MM) the phases lock.
 *
 * @param {string} status - Current initiative status (STATUS.* constant)
 * @returns {{ asIs: boolean, toBe: boolean }}
 */
export function getPhaseEditability(status) {
  switch (status) {
    case STATUS.RASCUNHO:
    case STATUS.SUBMETIDO:
    case STATUS.VALIDADO_MENTOR:
    case STATUS.EM_EXECUCAO:
    case STATUS.EM_REVISAO:
    case STATUS.EM_VALIDACAO_MENTOR:
      return { asIs: true, toBe: true };
    default:
      return { asIs: false, toBe: false };
  }
}

// Legacy compatibility: early records seeded the projected phase under
// `estimated` before the schema was finalized as `toBe`. Treat it as a
// transparent fallback so existing rows do not get stuck in EM_REVISAO.
function getToBePhase(payload) {
  if (!payload) return null;
  return payload.toBe || payload.estimated || null;
}

/**
 * Validates that every enabled category has both a complete As-Is phase and a
 * complete To-Be phase (all input fields present and numeric, 0 allowed) before the mentor
 * advances the initiative to the gestor (mentorSavingsValidation).
 * For the qualidade category, requires non-empty description text instead.
 * For the producao category with an active Simulador Financeiro override, the
 * raw As-Is/To-Be fields are optional -- the override value is the sole source
 * of truth for that metric's annual figure, mirroring computeAnnualizedToBeTotalEur.
 *
 * @param {Object|null} financials - Financials row from SP (auto-parsed)
 * @throws {SystemError} name='IncompleteFinancials', breaksFlow:false
 */
export function assertToBeComplete(financials) {
  if (!financials) return;
  const enabled = Array.isArray(financials.EnabledCategories) ? financials.EnabledCategories : [];
  if (enabled.length === 0) return;
  for (const key of enabled) {
    if (!CATEGORY_KEYS.includes(key)) continue;
    const categoryLabel = CATEGORY_LABELS[key] || key;

    // qualidade: skip the numeric As-Is/To-Be check, but require non-empty text
    if (key === 'qualidade') {
      const fieldName = CATEGORY_FIELD_NAMES[key];
      const raw = financials[fieldName];
      const payload = (raw && typeof raw === 'object') ? raw : null;
      const text = payload ? (payload.text || '') : '';
      if (!text.trim()) {
        throw new SystemError(
          'IncompleteFinancials',
          'Categoria "' + categoryLabel + '": descreva a melhoria de qualidade antes de pedir validação.',
          { breaksFlow: false },
        );
      }
      continue;
    }

    const fieldName = CATEGORY_FIELD_NAMES[key];
    const payload = financials[fieldName];

    // producao: when the Simulador Financeiro override is active, the raw
    // As-Is/To-Be inputs are not used for the financial result -- skip them.
    // Mirrors the same branch in computeAnnualizedToBeTotalEur.
    if (key === 'producao') {
      const sim = getSimuladorFromPayload(payload);
      if (sim.active) continue;
    }

    const inputKeys = INPUT_KEYS_BY_CATEGORY[key] || [];

    // Check As-Is completeness
    const asIsPayload = payload && payload.asIs;
    const asIsIncomplete = !asIsPayload || inputKeys.some(ik => {
      const v = asIsPayload[ik];
      return v == null || v === '' || !Number.isFinite(parseFloat(v));
    });
    if (asIsIncomplete) {
      throw new SystemError(
        'IncompleteFinancials',
        'Categoria "' + categoryLabel + '": preencha todos os valores As-Is antes de pedir validação.',
        { breaksFlow: false },
      );
    }

    // Check To-Be completeness
    const toBe = getToBePhase(payload);
    const toBeIncomplete = !toBe || inputKeys.some(ik => {
      const v = toBe[ik];
      return v == null || v === '' || !Number.isFinite(parseFloat(v));
    });
    if (toBeIncomplete) {
      throw new SystemError(
        'IncompleteFinancials',
        'Categoria "' + categoryLabel + '": preencha todos os valores To-Be antes de pedir validação.',
        { breaksFlow: false },
      );
    }
  }
}

/** Plain-payload variant of computePhaseTotal — operates on raw {vp,tu,...} object. */
function computeRawPhaseTotal(key, phaseObj) {
  if (!phaseObj) return 0;
  const v = (x) => parseFloat(x) || 0;
  if (key === 'eficiencia')    return v(phaseObj.vp) * v(phaseObj.tu);
  if (key === 'producao')      return v(phaseObj.vp) * v(phaseObj.mu);
  if (key === 'gastos')        return v(phaseObj.v)  * v(phaseObj.c);
  if (key === 'reducao_risco') return v(phaseObj.exp) * v(phaseObj.taxa) / 100;
  if (key === 'reducao_custo') return v(phaseObj.co);
  return 0;
}

/**
 * Computes the annualized REALIZED SAVING in € across all enabled categories.
 * Direction-aware: for 'decrease' categories the saving is asIs - toBe; for
 * 'increase' categories it is toBe - asIs. Name kept for compatibility (imported
 * by workflow-actions.js and emails.js).
 *
 * Used by routing tiers (isHighTier decision) and resolveFinalValidationLabel
 * (soft && |total| < 10k => PLACE label). Returns a signed value; both consumers
 * apply Math.abs so the magnitude threshold treats a loss the same as a gain.
 *
 * @param {Object|null} financials - Financials row from SP (auto-parsed)
 * @returns {number} Annualized realized saving in € (0 if no data)
 */
export function computeAnnualizedToBeTotalEur(financials) {
  if (!financials) return 0;
  const enabled = Array.isArray(financials.EnabledCategories) ? financials.EnabledCategories : [];
  const factor = getAnnualizationFactor(financials.TimePeriod || '') || 1;
  const fteCost = parseFloat(financials.FTEAnnualCost) || 0;

  let totalEur = 0;
  for (const key of enabled) {
    if (!CATEGORY_KEYS.includes(key)) continue;
    const fieldName = CATEGORY_FIELD_NAMES[key];
    const payload = financials[fieldName];

    // producao: when simulador is active use its value directly (already annual, no factor)
    if (key === 'producao') {
      const sim = getSimuladorFromPayload(payload);
      if (sim.active) {
        totalEur += sim.value;
        continue;
      }
    }

    // Direction-aware realized saving: decrease => asIs - toBe; increase => toBe - asIs
    const asIsRaw = computeRawPhaseTotal(key, payload && payload.asIs);
    const toBeRaw = computeRawPhaseTotal(key, getToBePhase(payload));
    const dir = CATEGORY_DIRECTIONS[key];
    const savingPeriod = dir === 'decrease' ? (asIsRaw - toBeRaw) : (toBeRaw - asIsRaw);

    if (key === 'eficiencia') {
      // Eficiencia saving is minutes per period -> annualized minutes -> FTE-years -> €
      totalEur += ((savingPeriod * factor) / FTE_MINUTES_PER_YEAR) * fteCost;
    } else {
      totalEur += savingPeriod * factor;
    }
  }
  return totalEur;
}

/**
 * Resolves the final validation label for an initiative based on its saving
 * category and annualized total.
 *
 * Logic:
 *  - isSoft = SavingCategory is a string in SOFT_CATEGORIES, or an array
 *    whose EVERY entry is in SOFT_CATEGORIES (any hard category present = not soft).
 *  - If isSoft AND |annualized total| < SOFT_SAVINGS_THRESHOLD_EUR => PLACE label.
 *  - All other cases => AREA_FINANCEIRA label.
 *
 * @param {Object} initiative - Initiative row (only SavingCategory is read from here,
 *   but callers can pass the initiative object directly for convenience).
 * @param {Object|null} financials - Financials row (used for annualized total computation).
 * @returns {string}
 */
export function resolveFinalValidationLabel(initiative, financials) {
  const rawCategory = (financials && financials.SavingCategory) || (initiative && initiative.SavingCategory);
  const cats = Array.isArray(rawCategory)
    ? rawCategory
    : (rawCategory ? [rawCategory] : []);

  const isSoft = cats.length > 0 && cats.every(c => SOFT_CATEGORIES.includes(c));
  const annualEur = computeAnnualizedToBeTotalEur(financials);

  // Threshold is on saving magnitude, matching the routing tier (getAssignedGestor),
  // so a large loss is treated as material rather than falling under the soft PLACE label.
  if (isSoft && Math.abs(annualEur) < SOFT_SAVINGS_THRESHOLD_EUR) {
    return MENTOR_MANAGER_LABELS.PLACE;
  }
  return MENTOR_MANAGER_LABELS.AREA_FINANCEIRA;
}

// True when the initiative will receive the financial-area (high-tier) validation label.
export function isFinanceValidated(initiative, financials) {
  return resolveFinalValidationLabel(initiative, financials) === MENTOR_MANAGER_LABELS.AREA_FINANCEIRA;
}

// Factory (NOT a const): SPARC component instances are stateful and mounted/disposed
// per use -- the side panel and the modal each need their own instance.
export function createFinanceValidationNotice() {
  return new Text(FINANCE_VALIDATION_NOTICE, {
    type: 'p',
    class: 'pace-field-callout pace-field-callout--block pace-field-callout--warning',
  });
}

// ---------------------------------------------------------------------------
// State factory
// ---------------------------------------------------------------------------

/**
 * Creates a category state object holding FormFields for both phases (asIs, toBe).
 * For the 'qualidade' metric, creates a text-only state (isText: true) with a
 * single FormField for the description.
 * FormFields are always created (regardless of stored data) -- the serialize
 * step decides which phases to persist.
 *
 * @param {string} key - Category key ('eficiencia'|'producao'|...|'qualidade')
 * @param {Object|null} storedPayload - Already-parsed JSON payload from SP (or null)
 * @param {{ asIs: boolean, toBe: boolean }} editability
 * @returns {CategoryState}
 */
export function createCategoryState(key, storedPayload, editability) {
  // Text-only special case for the qualidade metric
  if (key === 'qualidade') {
    const payload = storedPayload || {};
    const text = new FormField({ value: payload.text || '' });
    function dispose() { text.dispose(); }
    return { key, text, isText: true, editability, dispose };
  }

  const payload = storedPayload || {};
  const inputKeys = INPUT_KEYS_BY_CATEGORY[key];

  function makePhase(phase) {
    const source = phase === 'toBe' ? getToBePhase(payload) : payload[phase];
    const obj = {};
    for (const ik of inputKeys) {
      obj[ik] = new FormField({ value: parseInitial(source && source[ik]) });
    }
    return obj;
  }

  const asIs = makePhase('asIs');
  const toBe = makePhase('toBe');

  const computed = {
    asIsTotal:      () => computePhaseTotal(key, asIs),
    toBeTotal:      () => computePhaseTotal(key, toBe),
    realizedSaving: () => {
      const dir = CATEGORY_DIRECTIONS[key];
      return dir === 'decrease'
        ? computed.asIsTotal() - computed.toBeTotal()
        : computed.toBeTotal() - computed.asIsTotal();
    },
  };

  // Mode toggle (for reducao_custo: Custo evitado / Risco evitado)
  let mode = null;
  const modeConfig = CATEGORY_MODE_CONFIG[key];
  if (modeConfig) {
    const storedMode = payload.mode;
    const matchingOption = modeConfig.options.find(o => o.value === storedMode);
    const initialOption = matchingOption || modeConfig.options.find(o => o.value === modeConfig.default);
    mode = new FormField({ value: initialOption });
  }

  // Simulador Financeiro override (producao only)
  let simulador = null;
  if (key === 'producao') {
    simulador = new FormField({ value: parseInitial(payload.simulador) });
  }

  function dispose() {
    [asIs, toBe].forEach(phase => {
      Object.values(phase).forEach(field => field.dispose());
    });
    if (mode) mode.dispose();
    if (simulador) simulador.dispose();
  }

  return {
    key, asIs, toBe, computed, dispose, editability,
    ...(mode ? { mode } : {}),
    ...(simulador ? { simulador } : {}),
  };
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

/**
 * Serializes a category state to a JSON string for SP storage.
 * Returns '' if state is null/undefined (represents absent category).
 * For text-only states (qualidade), serializes { text }.
 * For numeric states, only phases with at least one non-empty input are written.
 *
 * @param {CategoryState|null|undefined} state
 * @returns {string}
 */
export function serializeCategory(state) {
  if (!state) return '';
  // Text-only state (qualidade)
  if (state.isText) {
    return JSON.stringify({ text: state.text.value || '' });
  }
  const payload = {};
  ['asIs', 'toBe'].forEach(phase => {
    const phaseObj = state[phase];
    const collected = {};
    let hasValue = false;
    Object.entries(phaseObj).forEach(([ik, field]) => {
      const n = num(field.value);
      collected[ik] = n;
      // A phase is included when any field has a non-empty, non-null string value
      // (even if that value happens to coerce to 0, we preserve explicit user input
      // that is a non-empty string -- but a literal 0 entered by the user still counts)
      if (field.value !== '' && field.value !== null && field.value !== undefined) {
        hasValue = true;
      }
    });
    if (hasValue) payload[phase] = collected;
  });
  if (state.mode) {
    payload.mode = extractComboBoxValue(state.mode.value);
  }
  if (state.simulador) {
    const r = resolveSimulador(state.simulador.value);
    if (r.active) payload.simulador = r.value;
  }
  return JSON.stringify(payload);
}

/**
 * True when at least one input field in the phase has a non-empty stored value.
 * Mirrors the predicate used inside serializeCategory.
 * @param {Object} phaseObj
 * @returns {boolean}
 */
function phaseHasValue(phaseObj) {
  return Object.values(phaseObj).some(f =>
    f.value !== '' && f.value !== null && f.value !== undefined
  );
}

// ---------------------------------------------------------------------------
// Hydration
// ---------------------------------------------------------------------------

/**
 * Builds a Map of category key -> CategoryState from a financials row.
 * Only categories listed in EnabledCategories are instantiated.
 *
 * @param {Object|null} financials - Financials row (auto-parsed by SPARC)
 * @param {{ asIs: boolean, toBe: boolean }} editability
 * @returns {Map<string, CategoryState>}
 */
export function hydrateCategoryStates(financials, editability) {
  const states = new Map();
  if (!financials) return states;
  const enabled = Array.isArray(financials.EnabledCategories) ? financials.EnabledCategories : [];
  for (const key of enabled) {
    if (!CATEGORY_KEYS.includes(key)) continue;
    const fieldName = CATEGORY_FIELD_NAMES[key];
    const raw = financials[fieldName];
    // raw is auto-parsed by SPARC's field-value layer when it starts with '{' -- it is already an object
    const payload = (raw && typeof raw === 'object') ? raw : null;
    states.set(key, createCategoryState(key, payload, editability));
  }
  return states;
}

// ---------------------------------------------------------------------------
// Per-phase builder helpers (internal)
// ---------------------------------------------------------------------------

/**
 * Renders input rows for a single phase.
 * Returns { rows: HTMDElement[], unsubs: Function[] }.
 * @param {string} key
 * @param {Object} phase - Phase FormField object
 * @param {boolean} editable - Whether inputs should be editable
 * @param {string} [timePeriod] - Optional time period for annualisation
 */
function buildPhaseInputRows(key, phase, editable, timePeriod) {
  const unsubs = [];
  const rows = [];

  const inputKeys = INPUT_KEYS_BY_CATEGORY[key];
  const labels    = INPUT_LABELS_BY_CATEGORY[key];

  if (editable) {
    for (const ik of inputKeys) {
      rows.push(new FieldLabel(labels[ik], new NumberInput(phase[ik], { placeholder: '0', min: 0 })));
    }
  } else {
    for (const ik of inputKeys) {
      const unit = INPUT_UNITS_BY_CATEGORY[key][ik] || '';
      const txt = new Text(displayValueWithUnit(phase[ik].value, unit), { type: 'span', class: 'pace-detail-value' });
      const unsub = phase[ik].subscribe(v => { txt.children = displayValueWithUnit(v, unit); });
      unsubs.push(unsub);
      rows.push(buildReadOnlyRow(labels[ik], txt, 'pace-detail-row--indent'));
    }
  }

  return { rows, unsubs };
}

/**
 * Renders a total row (and optional annualised total row).
 * Returns { rows: HTMDElement[], unsubs: Function[] }.
 * @param {string} key
 * @param {Object} phase - Phase FormField object (to subscribe)
 * @param {Function} totalFn - Computed total getter
 * @param {string} [timePeriod]
 */
function buildTotalRows(key, phase, totalFn, timePeriod) {
  const unsubs = [];
  const rows = [];
  const unit = CATEGORY_TOTAL_UNIT[key] || '';

  const totalTxt = new Text(displayValueWithUnit(totalFn(), unit), { type: 'span', class: 'pace-detail-value' });
  const annTxt   = timePeriod
    ? new Text(displayValueWithUnit(totalFn() * getAnnualizationFactor(timePeriod), unit), { type: 'span', class: 'pace-detail-value' })
    : null;

  function refresh() {
    const t = totalFn();
    totalTxt.children = displayValueWithUnit(t, unit);
    if (annTxt) annTxt.children = displayValueWithUnit(t * getAnnualizationFactor(timePeriod), unit);
  }

  for (const field of Object.values(phase)) {
    unsubs.push(field.subscribe(refresh));
  }

  rows.push(buildReadOnlyRow('Total', totalTxt, 'pace-detail-row--total'));
  if (annTxt) rows.push(buildReadOnlyRow('Total Anual', annTxt, 'pace-detail-row--total'));

  return { rows, unsubs };
}

// ---------------------------------------------------------------------------
// Per-phase public builders
// ---------------------------------------------------------------------------

/**
 * Builds the As-Is form (editable or read-only based on editability).
 *
 * @param {CategoryState} state
 * @param {{ isMentorOrGestor?: boolean, timePeriod?: string, extraInputs?: HTMDElement[] }} [opts]
 * @returns {{ components: HTMDElement[], dispose: () => void }}
 */
export function buildCategoryAsIsForm(state, opts = {}) {
  const { timePeriod, extraInputs = [] } = opts;
  const editable = state.editability.asIs;
  const unsubs = [];

  const { rows: inputRows, unsubs: inputUnsubs } = buildPhaseInputRows(state.key, state.asIs, editable, timePeriod);
  unsubs.push(...inputUnsubs);

  const components = [
    new Container([...inputRows, ...extraInputs], { class: 'pace-form-row' }),
  ];

  return { components, dispose: () => { unsubs.forEach(u => u && u()); } };
}

/**
 * Builds the To-Be form (editable or read-only based on editability).
 * When editable, also shows the derived realizedSaving value (subscribed to
 * both asIs and toBe fields so it stays current).
 *
 * @param {CategoryState} state
 * @param {{ isMentorOrGestor?: boolean, timePeriod?: string }} [opts]
 * @returns {{ components: HTMDElement[], dispose: () => void }}
 */
export function buildCategoryToBeForm(state, opts = {}) {
  const { timePeriod } = opts;
  const editable = state.editability.toBe;
  const unsubs = [];

  const { rows: inputRows, unsubs: inputUnsubs } = buildPhaseInputRows(state.key, state.toBe, editable, timePeriod);
  unsubs.push(...inputUnsubs);

  const components = [
    new Container(inputRows, { class: 'pace-form-row' }),
  ];

  return { components, dispose: () => { unsubs.forEach(u => u && u()); } };
}

/**
 * Builds a read-only summary of both phases (asIs and toBe) for use in the detail side panel.
 * Subscribes to FormFields so values stay live.
 *
 * @param {CategoryState} state
 * @param {{ isMentorOrGestor?: boolean, timePeriod?: string, fteAnnualCost?: number }} [opts]
 * @returns {{ components: HTMDElement[], dispose: () => void }}
 */
export function buildCategoryDisplay(state, opts = {}) {
  const { timePeriod, fteAnnualCost = 0 } = opts;
  const unsubs = [];

  // Text-only state (qualidade): render title + live description text
  if (state.isText) {
    const descTxt = new Text(state.text.value || '-', { type: 'span', class: 'pace-detail-value' });
    const unsub = state.text.subscribe(v => { descTxt.children = v || '-'; });
    unsubs.push(unsub);
    const components = [
      new Text(CATEGORY_LABELS[state.key], { type: 'h4', class: 'pace-form-section-title' }),
      buildReadOnlyRow('Descrição', descTxt),
    ];
    return { components, dispose: () => { unsubs.forEach(u => u && u()); } };
  }

  const sectionRows = [];

  function addPhaseSection(phaseLabel, phaseObj, totalFn) {
    const { rows: inputRows, unsubs: inputUnsubs } = buildPhaseInputRows(state.key, phaseObj, false, timePeriod);
    unsubs.push(...inputUnsubs);

    const { rows: totalRows, unsubs: totalUnsubs } = buildTotalRows(state.key, phaseObj, totalFn, timePeriod);
    unsubs.push(...totalUnsubs);

    sectionRows.push(
      new Text(phaseLabel, { type: 'h5', class: 'pace-form-section-title' }),
      ...inputRows,
      ...totalRows,
    );
  }

  addPhaseSection('As-Is', state.asIs, state.computed.asIsTotal);
  const showToBe = phaseHasValue(state.toBe);
  if (showToBe) {
    addPhaseSection('To-Be', state.toBe, state.computed.toBeTotal);
  }

  const components = [
    new Text(CATEGORY_LABELS[state.key], { type: 'h4', class: 'pace-form-section-title' }),
    ...sectionRows,
  ];

  // Mode sub-label (e.g. "Tipo: Custo evitado" for reducao_custo)
  if (state.mode) {
    const modeConfig = CATEGORY_MODE_CONFIG[state.key];
    const currentModeValue = extractComboBoxValue(state.mode.value);
    const modeOption = modeConfig && modeConfig.options.find(o => o.value === currentModeValue);
    const modeTxt = new Text(modeOption ? modeOption.label : currentModeValue || '-', { type: 'span', class: 'pace-detail-value' });
    components.push(buildReadOnlyRow(modeConfig ? modeConfig.label : 'Tipo', modeTxt));
  }

  if (showToBe) {
    const savingTxt = new Text(displayValueWithUnit(state.computed.realizedSaving(), CATEGORY_TOTAL_UNIT[state.key]), { type: 'span', class: 'pace-detail-value' });
    const refreshSaving = () => { savingTxt.children = displayValueWithUnit(state.computed.realizedSaving(), CATEGORY_TOTAL_UNIT[state.key]); };
    for (const field of [...Object.values(state.asIs), ...Object.values(state.toBe)]) {
      unsubs.push(field.subscribe(refreshSaving));
    }
    components.push(buildReadOnlyRow('Saving realizado', savingTxt));
  }

  // producao: simulador rows (annual platform gain, simulador value, effective annual)
  if (state.key === 'producao' && state.simulador) {
    const period = typeof timePeriod === 'string' ? timePeriod : '';
    const factor = getAnnualizationFactor(period);

    const annualPlatformTxt = new Text(
      displayValueWithUnit(state.computed.realizedSaving() * factor, '€'),
      { type: 'span', class: 'pace-detail-value' },
    );
    const refreshAnnualPlatform = () => {
      annualPlatformTxt.children = displayValueWithUnit(state.computed.realizedSaving() * factor, '€');
    };
    for (const field of [...Object.values(state.asIs), ...Object.values(state.toBe)]) {
      unsubs.push(field.subscribe(refreshAnnualPlatform));
    }
    components.push(buildReadOnlyRow('Saving realizado (anual)', annualPlatformTxt));

    const sim = resolveSimulador(state.simulador.value);
    const simuladorTxt = new Text(
      sim.active ? displayValueWithUnit(sim.value, '€') : '-',
      { type: 'span', class: 'pace-detail-value' },
    );
    const refreshSimulador = () => {
      const simLive = resolveSimulador(state.simulador.value);
      simuladorTxt.children = simLive.active ? displayValueWithUnit(simLive.value, '€') : '-';
    };
    unsubs.push(state.simulador.subscribe(refreshSimulador));
    components.push(buildReadOnlyRow('Simulador Financeiro (anual)', simuladorTxt));
  }

  // Eficiencia: surface the FTE annual cost when set (mentor/gestor input)
  if (state.key === 'eficiencia' && fteAnnualCost > 0) {
    const fteCostTxt = new Text(formatEur(fteAnnualCost), { type: 'span', class: 'pace-detail-value' });
    components.push(buildReadOnlyRow('Custo Anual por FTE', fteCostTxt));
  }

  return { components, dispose: () => { unsubs.forEach(u => u && u()); } };
}

// ---------------------------------------------------------------------------
// Totals panel
// ---------------------------------------------------------------------------

/**
 * Builds the totals panel (logic-only; styling is the caller's concern).
 * Renders two side-by-side blocks: per-period and annualised.
 * FTE rows appear only in the annualised block (FTE is a yearly concept).
 *
 * @param {Map<string, CategoryState>} categoryStates
 * @param {{
 *   phase: 'asIs'|'toBe'|'realized',
 *   timePeriod?: string|FormField,
 *   fteAnnualCost?: number|FormField,
 * }} opts
 * @returns {{ component: Container, refresh: () => void, dispose: () => void }}
 */
export function buildTotalsPanel(categoryStates, opts = {}) {
  const { phase = 'asIs' } = opts;
  const unsubs = [];

  // Detect whether timePeriod is a live FormField or a static string
  const timePeriodOpt = opts.timePeriod;
  const isTimePeriodField = timePeriodOpt != null
    && typeof timePeriodOpt === 'object'
    && typeof timePeriodOpt.subscribe === 'function';
  const getPeriod = isTimePeriodField
    ? () => extractComboValue(timePeriodOpt)
    : () => (timePeriodOpt || '');

  // Detect whether fteAnnualCost is a live FormField or a static number
  const fteOpt = opts.fteAnnualCost;
  const isFteField = fteOpt != null
    && typeof fteOpt === 'object'
    && typeof fteOpt.subscribe === 'function';
  const getFteCost = isFteField
    ? () => parseFloat(fteOpt.value) || 0
    : () => parseFloat(fteOpt) || 0;

  // Computed value accessors
  function getStateValue(key) {
    const state = categoryStates.get(key);
    if (!state) return 0;
    if (phase === 'realized') return state.computed.realizedSaving();
    if (phase === 'asIs')      return state.computed.asIsTotal();
    if (phase === 'toBe')      return state.computed.toBeTotal();
    return 0;
  }

  // -- Static text nodes for totals and eficiencia-specific rows --
  const pEurTotalTxt = new Text('', { type: 'span', class: 'pace-detail-value' });
  const pTimeTxt     = new Text('', { type: 'span', class: 'pace-detail-value' });
  const pFteTxt      = new Text('', { type: 'span', class: 'pace-detail-value' });
  const pFteCostTxt  = new Text('', { type: 'span', class: 'pace-detail-value' });

  const aEurTotalTxt = new Text('', { type: 'span', class: 'pace-detail-value' });
  const aTimeTxt     = new Text('', { type: 'span', class: 'pace-detail-value' });
  const fteTxt       = new Text('', { type: 'span', class: 'pace-detail-value' });
  const fteCostTxt   = new Text('', { type: 'span', class: 'pace-detail-value' });

  // -- Per-category € text nodes (one pair per enabled € category, keyed by category key) --
  // These are created once per buildTotalsPanel call for all currently-enabled € categories.
  const pEurCatTxts = new Map(); // key -> Text node (per-period)
  const aEurCatTxts = new Map(); // key -> Text node (annual)
  for (const key of CATEGORY_KEYS) {
    if (key === 'eficiencia') continue; // handled separately via FTE conversion
    if (CATEGORY_TOTAL_UNIT[key] === '€' && categoryStates.has(key)) {
      pEurCatTxts.set(key, new Text('', { type: 'span', class: 'pace-detail-value' }));
      aEurCatTxts.set(key, new Text('', { type: 'span', class: 'pace-detail-value' }));
    }
  }

  // -- Period header label text node (updates when timePeriod field changes) --
  const periodHeaderTxt = new Text('', { type: 'h4', class: 'pace-totals-title' });

  function refresh() {
    const period = getPeriod();
    const factor = getAnnualizationFactor(period) || 1;
    const fteCost = getFteCost();

    const rawEficiencia = getStateValue('eficiencia');

    // Per-period eficiencia values
    const pTime         = rawEficiencia;
    const pEficienciaEur = (pTime * fteCost) / FTE_MINUTES_PER_YEAR;

    // Annualised eficiencia values
    const aTime         = rawEficiencia * factor;
    const fte           = aTime / FTE_MINUTES_PER_YEAR;
    const aEficienciaEur = fte * fteCost;

    // Sum up all € categories (excluding eficiencia which goes via FTE)
    let pEurCatTotal = 0;
    let aEurCatTotal = 0;
    for (const [key, pTxt] of pEurCatTxts) {
      const raw = getStateValue(key);
      const pVal = raw;
      let aVal = raw * factor;

      // producao: when phase is 'realized' and simulador is active, override the annual value
      if (key === 'producao' && phase === 'realized') {
        const prodState = categoryStates.get('producao');
        if (prodState && prodState.simulador) {
          const sim = resolveSimulador(prodState.simulador.value);
          if (sim.active) aVal = sim.value;
        }
      }

      pEurCatTotal += pVal;
      aEurCatTotal += aVal;
      pTxt.children = formatEur(pVal);
      aEurCatTxts.get(key).children = formatEur(aVal);
    }

    const pEurTotal = pEurCatTotal + pEficienciaEur;
    const aEurTotal = aEurCatTotal + aEficienciaEur;

    // Period header
    const periodLabel = period || 'sem período';
    periodHeaderTxt.children = 'Totais (' + periodLabel + ')';

    // Per-period block
    pEurTotalTxt.children = formatEur(pEurTotal);
    pTimeTxt.children     = displayValue(pTime) + ' min';
    pFteTxt.children      = formatFte(fte);
    pFteCostTxt.children  = formatEur(pEficienciaEur);

    // Annualised block
    aEurTotalTxt.children = formatEur(aEurTotal);
    aTimeTxt.children     = displayValue(aTime) + ' min';
    fteTxt.children       = formatFte(fte);
    fteCostTxt.children   = formatEur(aEficienciaEur);
  }

  // Subscribe to all FormFields across enabled categories (numeric fields only, skip text states)
  for (const state of categoryStates.values()) {
    if (state.isText) continue;
    for (const phaseObj of [state.asIs, state.toBe]) {
      for (const field of Object.values(phaseObj)) {
        unsubs.push(field.subscribe(refresh));
      }
    }
  }

  // Subscribe to live timePeriod field if provided
  if (isTimePeriodField) {
    unsubs.push(timePeriodOpt.subscribe(refresh));
  }

  // Subscribe to live fteAnnualCost field if provided
  if (isFteField) {
    unsubs.push(fteOpt.subscribe(refresh));
  }

  // Subscribe to producao simulador field (realized phase only) so annual totals update live
  if (phase === 'realized') {
    const prodState = categoryStates.get('producao');
    if (prodState && prodState.simulador) {
      unsubs.push(prodState.simulador.subscribe(refresh));
    }
  }

  // -- Build block children --
  const hasEficiencia = categoryStates.has('eficiencia');
  const showEficienciaEurRow = hasEficiencia && (isFteField || parseFloat(fteOpt) > 0);
  const hasEur = pEurCatTxts.size > 0 || showEficienciaEurRow;

  // Per-period € block
  const pEurBlockChildren = [
    new Container([
      new Text('Impacto Financeiro', { type: 'span', class: 'pace-detail-label' }),
      pEurTotalTxt,
    ], { class: 'pace-detail-row pace-detail-row--total' }),
  ];
  for (const [key, pTxt] of pEurCatTxts) {
    pEurBlockChildren.push(new Container([
      new Text(CATEGORY_LABELS[key], { type: 'span', class: 'pace-detail-label' }),
      pTxt,
    ], { class: 'pace-detail-row pace-detail-row--indent' }));
  }
  if (showEficienciaEurRow) {
    pEurBlockChildren.push(new Container([
      new Text('Eficiência (Custo FTE)', { type: 'span', class: 'pace-detail-label' }),
      pFteCostTxt,
    ], { class: 'pace-detail-row pace-detail-row--indent' }));
  }

  const pTimeBlockChildren = [];
  if (hasEficiencia) {
    pTimeBlockChildren.push(
      new Container([
        new Text('Tempo', { type: 'span', class: 'pace-detail-label' }),
        pTimeTxt,
      ], { class: 'pace-detail-row pace-detail-row--total' }),
      new Container([
        new Text('FTE equivalente', { type: 'span', class: 'pace-detail-label' }),
        pFteTxt,
      ], { class: 'pace-detail-row pace-detail-row--indent' }),
    );
  }

  const periodBlockChildren = [];
  if (hasEur) {
    periodBlockChildren.push(new Container(pEurBlockChildren, { class: 'pace-totals-block-inner' }));
  }
  if (pTimeBlockChildren.length > 0) {
    periodBlockChildren.push(new Container(pTimeBlockChildren, { class: 'pace-totals-block-inner' }));
  }

  // Annualised € block
  const aEurBlockChildren = [
    new Container([
      new Text('Impacto Financeiro', { type: 'span', class: 'pace-detail-label' }),
      aEurTotalTxt,
    ], { class: 'pace-detail-row pace-detail-row--total' }),
  ];
  for (const [key, aTxt] of aEurCatTxts) {
    aEurBlockChildren.push(new Container([
      new Text(CATEGORY_LABELS[key], { type: 'span', class: 'pace-detail-label' }),
      aTxt,
    ], { class: 'pace-detail-row pace-detail-row--indent' }));
  }
  if (showEficienciaEurRow) {
    aEurBlockChildren.push(new Container([
      new Text('Eficiência (Custo FTE)', { type: 'span', class: 'pace-detail-label' }),
      fteCostTxt,
    ], { class: 'pace-detail-row pace-detail-row--indent' }));
  }

  const aTimeBlockChildren = [];
  if (hasEficiencia) {
    aTimeBlockChildren.push(
      new Container([
        new Text('Tempo', { type: 'span', class: 'pace-detail-label' }),
        aTimeTxt,
      ], { class: 'pace-detail-row pace-detail-row--total' }),
      new Container([
        new Text('FTE equivalente', { type: 'span', class: 'pace-detail-label' }),
        fteTxt,
      ], { class: 'pace-detail-row pace-detail-row--indent' }),
    );
  }

  const annualBlockChildren = [];
  if (hasEur) {
    annualBlockChildren.push(new Container(aEurBlockChildren, { class: 'pace-totals-block-inner' }));
  }
  if (aTimeBlockChildren.length > 0) {
    annualBlockChildren.push(new Container(aTimeBlockChildren, { class: 'pace-totals-block-inner' }));
  }

  // -- Assemble the two-block layout --
  const panelChildren = [
    new Container([
      new Container([
        periodHeaderTxt,
        ...periodBlockChildren,
      ], { class: 'pace-totals-block pace-totals-block-period' }),
      new Container([
        new Text('Totais Anuais', { type: 'h4', class: 'pace-totals-title' }),
        ...annualBlockChildren,
      ], { class: 'pace-totals-block pace-totals-block-annual' }),
    ], { class: 'pace-totals-blocks-row' }),
  ];

  const component = new Container(panelChildren, { class: 'pace-totals-panel' });

  // Initial render
  refresh();

  return {
    component,
    refresh,
    dispose: () => { unsubs.forEach(u => u && u()); },
  };
}

/**
 * Builds the "Impacto Financeiro Projectado" summary: the To-Be − As-Is
 * difference for both the per-period and the annualised financial totals.
 * Mirrors buildTotalsPanel's € computation (producao + gastos + eficiência·FTE)
 * so the numbers reconcile with the As-Is / To-Be cards. Reactive to category
 * fields, timePeriod, and fteAnnualCost.
 *
 * @param {Map<string, CategoryState>} categoryStates
 * @param {{ timePeriod?: string|FormField, fteAnnualCost?: number|FormField }} opts
 * @returns {{ component: Container, refresh: () => void, dispose: () => void }}
 */
export function buildImpactSummaryPanel(categoryStates, opts = {}) {
  const unsubs = [];

  const timePeriodOpt = opts.timePeriod;
  const isTimePeriodField = timePeriodOpt != null
    && typeof timePeriodOpt === 'object'
    && typeof timePeriodOpt.subscribe === 'function';
  const getPeriod = isTimePeriodField
    ? () => extractComboValue(timePeriodOpt)
    : () => (timePeriodOpt || '');

  const fteOpt = opts.fteAnnualCost;
  const isFteField = fteOpt != null
    && typeof fteOpt === 'object'
    && typeof fteOpt.subscribe === 'function';
  const getFteCost = isFteField
    ? () => parseFloat(fteOpt.value) || 0
    : () => parseFloat(fteOpt) || 0;

  const catVal = (key, phaseKey) => {
    const s = categoryStates.get(key);
    if (!s) return 0;
    return phaseKey === 'toBe' ? s.computed.toBeTotal() : s.computed.asIsTotal();
  };

  /**
   * Computes the total € for all non-eficiencia categories in the given phase.
   * Each category's direction determines its contribution sign.
   * - 'increase' (producao): benefit = toBe - asIs
   * - 'decrease' (gastos, reducao_risco, reducao_custo): benefit = asIs - toBe
   * Eficiencia is excluded here (handled via FTE conversion separately).
   */
  const phaseEur = (phaseKey, fteCost) => {
    let total = 0;
    for (const key of CATEGORY_KEYS) {
      if (key === 'eficiencia') continue;
      if (CATEGORY_TOTAL_UNIT[key] !== '€') continue;
      if (!categoryStates.has(key)) continue;
      total += catVal(key, phaseKey);
    }
    return total + (catVal('eficiencia', phaseKey) * fteCost) / FTE_MINUTES_PER_YEAR;
  };

  const signClass = (v) => (v >= 0 ? 'pace-impact--pos' : 'pace-impact--neg');
  const fmtSigned = (v) => (v > 0 ? '+' : '') + formatEur(v);

  /**
   * Computes the net benefit (€) across all categories. A positive value means the
   * change is beneficial. Direction defines what "better" means per category:
   * - 'increase' = gain (more is better) -> benefit = toBe - asIs
   * - 'decrease' = saving (less is better) -> benefit = asIs - toBe
   * Eficiencia uses its FTE cost conversion.
   */
  const benefitEur = (fteCost) => {
    let benefit = 0;
    for (const key of CATEGORY_KEYS) {
      if (key === 'eficiencia') continue;
      if (CATEGORY_TOTAL_UNIT[key] !== '€') continue;
      if (!categoryStates.has(key)) continue;
      const dir = CATEGORY_DIRECTIONS[key];
      if (key === 'producao') {
        const prod = categoryStates.get('producao');
        if (prod && prod.simulador) {
          const sim = resolveSimulador(prod.simulador.value);
          if (sim.active) {
            // producao is an 'increase' category: benefit = gain = sim.value
            benefit += sim.value;
            continue;
          }
        }
      }
      benefit += dir === 'increase'
        ? catVal(key, 'toBe') - catVal(key, 'asIs')
        : catVal(key, 'asIs') - catVal(key, 'toBe');
    }
    benefit += ((catVal('eficiencia', 'asIs') - catVal('eficiencia', 'toBe')) * fteCost) / FTE_MINUTES_PER_YEAR;
    return benefit;
  };

  const hasEficiencia = categoryStates.has('eficiencia');
  const periodPill = new Container([], { class: 'pace-impact-pill' });
  const annualPill = new Container([], { class: 'pace-impact-pill' });
  const timePeriodPill = new Container([], { class: 'pace-impact-pill' });
  const timeAnnualPill = new Container([], { class: 'pace-impact-pill' });
  const fteAnnualPill = new Container([], { class: 'pace-impact-pill' });
  const fmtTime = (v) => (v > 0 ? '+' : '') + displayValue(v) + ' min';
  const fmtFteSigned = (v) => (v > 0 ? '+' : '') + formatFte(v);

  function refresh() {
    const period = getPeriod();
    const factor = getAnnualizationFactor(period) || 1;
    const fteCost = getFteCost();

    const periodDiff = phaseEur('toBe', fteCost) - phaseEur('asIs', fteCost);
    let annualDiff = periodDiff * factor;

    // producao simulador override: remove the platform annual contribution and add the override.
    // producao is an 'increase' category: a gain shows a positive raw diff (toBe - asIs).
    const prod = categoryStates.get('producao');
    if (prod && prod.simulador) {
      const sim = resolveSimulador(prod.simulador.value);
      if (sim.active) {
        const prodPeriodDiff = prod.computed.toBeTotal() - prod.computed.asIsTotal(); // platform per-period net change
        annualDiff = annualDiff - (prodPeriodDiff * factor) + sim.value;
      }
    }

    // Colour by benefit, not by the raw diff sign (a cost reduction shows a
    // negative diff but is a positive outcome -> green). Annual shares the sign.
    const benefit = benefitEur(fteCost);
    const colour = signClass(benefit);

    periodPill.children = [
      new Text(period || 'Período', { type: 'span', class: 'pace-impact-pill-label' }),
      new Text(fmtSigned(periodDiff), { type: 'span', class: 'pace-impact-pill-value ' + colour }),
    ];
    annualPill.children = [
      new Text('Anual', { type: 'span', class: 'pace-impact-pill-label' }),
      new Text(fmtSigned(annualDiff), { type: 'span', class: 'pace-impact-pill-value ' + colour }),
    ];

    if (hasEficiencia) {
      // Allocated-time difference (minutes). Less time is better -> green.
      const periodTimeDiff = catVal('eficiencia', 'toBe') - catVal('eficiencia', 'asIs');
      const annualTimeDiff = periodTimeDiff * factor;
      const timeColour = signClass(-periodTimeDiff);
      timePeriodPill.children = [
        new Text('Tempo (' + (period || 'Período') + ')', { type: 'span', class: 'pace-impact-pill-label' }),
        new Text(fmtTime(periodTimeDiff), { type: 'span', class: 'pace-impact-pill-value ' + timeColour }),
      ];
      timeAnnualPill.children = [
        new Text('Tempo (Anual)', { type: 'span', class: 'pace-impact-pill-label' }),
        new Text(fmtTime(annualTimeDiff), { type: 'span', class: 'pace-impact-pill-value ' + timeColour }),
      ];
      const annualFteDiff = annualTimeDiff / FTE_MINUTES_PER_YEAR;
      fteAnnualPill.children = [
        new Text('FTE (Anual)', { type: 'span', class: 'pace-impact-pill-label' }),
        new Text(fmtFteSigned(annualFteDiff), { type: 'span', class: 'pace-impact-pill-value ' + timeColour }),
      ];
    }
  }

  for (const state of categoryStates.values()) {
    if (state.isText) continue;
    for (const phaseObj of [state.asIs, state.toBe]) {
      for (const field of Object.values(phaseObj)) {
        unsubs.push(field.subscribe(refresh));
      }
    }
  }
  if (isTimePeriodField) unsubs.push(timePeriodOpt.subscribe(refresh));
  if (isFteField) unsubs.push(fteOpt.subscribe(refresh));

  // Subscribe to producao simulador so the annual pill updates live
  const prodStateForImpact = categoryStates.get('producao');
  if (prodStateForImpact && prodStateForImpact.simulador) {
    unsubs.push(prodStateForImpact.simulador.subscribe(refresh));
  }

  const component = new Container([
    new Text('Impacto Financeiro Projectado', { type: 'span', class: 'pace-impact-title' }),
    new Container([
      new Container([periodPill, annualPill], { class: 'pace-impact-group' }),
      ...(hasEficiencia ? [new Container([timePeriodPill, timeAnnualPill, fteAnnualPill], { class: 'pace-impact-group' })] : []),
    ], { class: 'pace-impact-row' }),
  ], { class: 'pace-impact-summary' });

  refresh();

  return {
    component,
    refresh,
    dispose: () => { unsubs.forEach(u => u && u()); },
  };
}

// ---------------------------------------------------------------------------
// Shared financial schema factory (DRY across modals)
// ---------------------------------------------------------------------------

const TIME_PERIOD_LABELS = {
  Diario: 'Diário',
  Mensal: 'Mensal',
};
const TIME_PERIOD_OPTIONS = Object.keys(ANNUALIZATION_FACTORS).map(k => ({ label: TIME_PERIOD_LABELS[k] || k, value: k }));

/**
 * Builds the shared financial schema (TimePeriod + optional FTEAnnualCost).
 * SavingCategory/SavingType are now inferred from metrics, so they are no longer
 * included here. Returns a pre-wired schema, the field-label components, and a
 * dispose function. Hydrates from an existing financials row when provided.
 *
 * @param {Object|null} financials - Existing financials row, or null for new
 * @param {{ isMentorOrGestor?: boolean, readOnly?: boolean }} [opts]
 * @returns {{ schema: FormSchema, components: HTMDElement[], dispose: () => void }}
 */
export function buildSharedFinancialSchema(financials, opts = {}) {
  const { isMentorOrGestor = false, readOnly = false } = opts;

  // TimePeriod -- defaults to Mensal for new initiatives; pre-fills from existing
  // financials on edit. (Period alone does not mark financials as "touched".)
  const existingPeriod = financials?.TimePeriod || 'Mensal';
  const timePeriodField = new FormField({
    value: { label: TIME_PERIOD_LABELS[existingPeriod] || existingPeriod, value: existingPeriod },
  });

  const schemaFields = { timePeriod: timePeriodField };

  // FTEAnnualCost -- mentor/gestor only
  let fteField = null;
  if (isMentorOrGestor) {
    fteField = new FormField({ value: parseInitial(financials?.FTEAnnualCost) });
    schemaFields.fteAnnualCost = fteField;
  }

  const schema = new FormSchema(schemaFields);

  const components = [];

  if (readOnly) {
    components.push(
      buildReadOnlyRow('Período', new Text((existingPeriod && (TIME_PERIOD_LABELS[existingPeriod] || existingPeriod)) || '-', { type: 'span', class: 'pace-detail-value' })),
    );
    // Note: Custo Anual por FTE is rendered inside the Eficiencia card by buildCategoryDisplay
  } else {
    components.push(
      new Container([
        new FieldLabel('Período de Medição', createSegmentedToggle(timePeriodField, TIME_PERIOD_OPTIONS), { class: 'pace-required' }),
        new Text('Período base sobre o qual os valores de eficiência, produção ou gastos são medidos. Define o factor de anualização (Diário x252, Mensal x12) usado para converter o impacto recorrente em ganho anual.', { type: 'p', class: 'pace-field-callout pace-field-callout--wide' }),
      ], { class: 'pace-field-callout-row pace-field-callout-row--center' }),
    );
    // Note: FTE Anual cost input is rendered inside the Eficiencia tab by buildCategoryTabbedSection
  }

  function dispose() {
    timePeriodField.dispose();
    if (fteField) fteField.dispose();
  }

  return { schema, components, dispose };
}

// ---------------------------------------------------------------------------
// Inferred classification section
// ---------------------------------------------------------------------------

/**
 * Builds a read-only "Classificação do Saving" section that auto-refreshes
 * whenever categoryStates changes (driven by changeCounter).
 * Displays the inferred categories and Hard/Soft classification derived from
 * the metrics the user has selected.
 *
 * @param {Map<string, CategoryState>} categoryStates
 * @param {FormField<number>} changeCounter - From buildCategoryTabbedSection
 * @returns {{ component: Container, refresh: () => void, dispose: () => void }}
 */
export function buildInferredClassification(categoryStates, changeCounter) {
  const unsubs = [];

  const categoriesTxt = new Text('-', { type: 'span', class: 'pace-detail-value' });
  const classificationTxt = new Text('-', { type: 'span', class: 'pace-detail-value pace-saving-type-value' });

  function refresh() {
    const keys = Array.from(categoryStates.keys());
    const cats = inferCategoriesFromMetrics(keys);
    categoriesTxt.children = cats.join(', ') || '-';

    const shortLabel = keys.length > 0 ? formatSavingTypeShort(inferSavingTypeFromMetrics(keys)) : '-';
    classificationTxt.children = shortLabel;
  }

  const unsub = changeCounter.subscribe(refresh);
  unsubs.push(unsub);
  refresh();

  const component = new Container([
    new Text('Classificação do Saving', { type: 'h4', class: 'pace-form-section-title' }),
    new Container([
      buildReadOnlyRow('Categorias', categoriesTxt),
      buildReadOnlyRow('Classificação', classificationTxt),
    ], { class: 'pace-inferred-classification-rows' }),
  ], { class: 'pace-inferred-classification' });

  return {
    component,
    refresh,
    dispose: () => { unsubs.forEach(u => u && u()); },
  };
}

// ---------------------------------------------------------------------------
// Category tabbed section builder
// ---------------------------------------------------------------------------

/**
 * Builds the add-category controls + TabGroup + totals panel side by side.
 * Returns the assembled container, a `rebuild()` function for when the tab set changes,
 * and a `dispose()` for full cleanup.
 *
 * Callers subscribe to the returned `changeCounter` to react to adds/removes.
 *
 * @param {Map<string, CategoryState>} categoryStates
 * @param {{
 *   editability: { asIs: boolean },
 *   timePeriod?: string|FormField,
 *   fteAnnualCost?: number|FormField,
 *   isMentorOrGestor?: boolean,
 * }} opts
 * @returns {{
 *   container: Container,
 *   changeCounter: FormField<number>,
 *   rebuild: () => void,
 *   dispose: () => void,
 * }}
 */
export function buildCategoryTabbedSection(categoryStates, opts = {}) {
  const { editability, timePeriod, fteAnnualCost = 0, isMentorOrGestor = false } = opts;
  const canModify = editability && editability.asIs;
  const fteAnnualCostIsField = fteAnnualCost && typeof fteAnnualCost === 'object' && typeof fteAnnualCost.subscribe === 'function';

  // Track disposal of each tab's builder result
  const builderResults = new Map(); // key -> { dispose }
  const changeCounter = new FormField(0);
  const unsubs = [];

  // -- Totals panels (rebuilt on category changes) --
  let asIsTotalsResult = buildTotalsPanel(categoryStates, { phase: 'asIs', timePeriod, fteAnnualCost });
  let toBeTotalsResult = buildTotalsPanel(categoryStates, { phase: 'toBe', timePeriod, fteAnnualCost });
  let impactSummaryResult = buildImpactSummaryPanel(categoryStates, { timePeriod, fteAnnualCost });

  // -- Tab content builder --
  function buildTabView(key, state) {
    // Text-only state (qualidade): render a TextArea instead of numeric As-Is/To-Be sections
    if (state.isText) {
      const removeUnsubs = [];
      const disposeTextTab = () => { removeUnsubs.forEach(u => u && u()); };
      builderResults.set(key, { dispose: disposeTextTab });

      const editable = state.editability && state.editability.asIs;
      let textContent;
      if (editable) {
        textContent = new FieldLabel('Descrição da melhoria', new TextArea(state.text, { placeholder: 'Descreva a melhoria de qualidade...', rows: 4 }));
      } else {
        const descTxt = new Text(state.text.value || '-', { type: 'span', class: 'pace-detail-value' });
        const unsub = state.text.subscribe(v => { descTxt.children = v || '-'; });
        removeUnsubs.push(unsub);
        textContent = buildReadOnlyRow('Descrição da melhoria', descTxt);
      }

      const tabChildren = [
        new Container([textContent], { class: 'pace-tab-form pace-qualidade-tab-form' }),
      ];

      if (canModify) {
        const removeBtn = new Button('Remover Métrica', {
          variant: 'danger',
          isOutlined: true,
          onClickHandler: () => {
            state.dispose();
            disposeTextTab();
            builderResults.delete(key);
            categoryStates.delete(key);
            changeCounter.value = (changeCounter.value || 0) + 1;
          },
        });
        tabChildren.push(new Container([removeBtn], { class: 'pace-tab-remove-row' }));
      }

      return new View(tabChildren);
    }

    // FTE Anual cost input lives inside the Eficiencia tab inputs row (mentor/gestor only)
    const extraInputs = (key === 'eficiencia' && isMentorOrGestor && fteAnnualCostIsField)
      ? [new FieldLabel('Custo Anual por FTE (€)', new NumberInput(fteAnnualCost, { placeholder: '0', min: 0 }), { class: 'pace-required' })]
      : [];

    const asIsResult = buildCategoryAsIsForm(state, { timePeriod, extraInputs });
    const toBeResult = buildCategoryToBeForm(state, { timePeriod });

    // Simulador Financeiro block (producao only)
    const simuladorUnsubs = [];
    const simuladorBlockComponents = [];

    if (key === 'producao' && state.simulador) {
      // Resolve period: timePeriod can be a FormField or a plain string
      const isTimePeriodField = timePeriod != null
        && typeof timePeriod === 'object'
        && typeof timePeriod.subscribe === 'function';
      const getPeriodStr = isTimePeriodField
        ? () => extractComboValue(timePeriod)
        : () => (typeof timePeriod === 'string' ? timePeriod : '');

      // Platform annual saving display (live)
      const platformAnnualTxt = new Text(
        displayValueWithUnit(state.computed.realizedSaving() * getAnnualizationFactor(getPeriodStr()), '€'),
        { type: 'span', class: 'pace-detail-value' },
      );
      const refreshPlatformAnnual = () => {
        platformAnnualTxt.children = displayValueWithUnit(
          state.computed.realizedSaving() * getAnnualizationFactor(getPeriodStr()),
          '€',
        );
      };
      for (const field of [...Object.values(state.asIs), ...Object.values(state.toBe)]) {
        simuladorUnsubs.push(field.subscribe(refreshPlatformAnnual));
      }
      if (isTimePeriodField) {
        simuladorUnsubs.push(timePeriod.subscribe(refreshPlatformAnnual));
      }

      // Simulador value display (live)
      const sim = resolveSimulador(state.simulador.value);
      const simuladorValTxt = new Text(
        sim.active ? displayValueWithUnit(sim.value, '€') : '-',
        { type: 'span', class: 'pace-detail-value' },
      );
      const refreshSimuladorVal = () => {
        const simLive = resolveSimulador(state.simulador.value);
        simuladorValTxt.children = simLive.active ? displayValueWithUnit(simLive.value, '€') : '-';
      };
      simuladorUnsubs.push(state.simulador.subscribe(refreshSimuladorVal));

      simuladorBlockComponents.push(
        new Text('Simulador Financeiro', { type: 'h5', class: 'pace-form-section-title' }),
        new Text(
          'Leve o total calculado pela plataforma ao seu simulador externo e introduza aqui o valor anual final. Quando preenchido, este valor substitui o saving calculado pela plataforma para esta métrica.',
          { type: 'p', class: 'pace-field-callout pace-field-callout--block' },
        ),
      );

      if (canModify) {
        simuladorBlockComponents.push(
          new FieldLabel(
            'Simulador Financeiro (€, anual)',
            new NumberInput(state.simulador, { placeholder: '0', min: 0 }),
          ),
        );
      } else {
        simuladorBlockComponents.push(
          buildReadOnlyRow('Simulador Financeiro (€, anual)', simuladorValTxt),
        );
      }

      simuladorBlockComponents.push(
        buildReadOnlyRow('Saving calculado pela plataforma (anual)', platformAnnualTxt),
      );
      if (canModify) {
        simuladorBlockComponents.push(buildReadOnlyRow('Simulador Financeiro (anual)', simuladorValTxt));
      }
    }

    builderResults.set(key, {
      dispose: () => {
        asIsResult.dispose();
        toBeResult.dispose();
        simuladorUnsubs.forEach(u => u && u());
      },
    });

    // Mode toggle (for reducao_custo: Custo evitado / Risco evitado)
    const modeToggleChildren = [];
    if (state.mode) {
      const modeConfig = CATEGORY_MODE_CONFIG[key];
      modeToggleChildren.push(
        new FieldLabel(modeConfig.label, createSegmentedToggle(state.mode, modeConfig.options, { isDisabled: !canModify })),
      );
    }

    const tabChildren = [
      new Container([
        ...modeToggleChildren,
        new Text('As-Is (situação actual)', { type: 'h5', class: 'pace-form-section-title' }),
        ...asIsResult.components,
        new Text('To-Be (situação futura)', { type: 'h5', class: 'pace-form-section-title' }),
        ...toBeResult.components,
        ...simuladorBlockComponents,
      ], { class: 'pace-tab-form' }),
    ];

    if (canModify) {
      const removeBtn = new Button('Remover Métrica', {
        variant: 'danger',
        isOutlined: true,
        onClickHandler: () => {
          state.dispose();
          builderResults.get(key)?.dispose();
          builderResults.delete(key);
          categoryStates.delete(key);
          changeCounter.value = (changeCounter.value || 0) + 1;
        },
      });
      tabChildren.push(new Container([removeBtn], { class: 'pace-tab-remove-row' }));
    }

    return new View(tabChildren);
  }

  // -- TabGroup (rebuilt when categories change) --
  // TabGroup has addTabs() but no removeTab(). Strategy: rebuild on every remove.
  // Adds are handled with addTabs() for efficiency; removes require full rebuild.
  let tabGroupContainer = new Container([], { class: 'pace-tabgroup-wrap' });
  let pendingFocusKey = null;

  function buildTabGroupFresh() {
    // Dispose all existing builders (tab views), but NOT category states (those survive)
    for (const [k, r] of builderResults) {
      r.dispose();
      builderResults.delete(k);
    }

    if (categoryStates.size === 0) {
      tabGroupContainer.children = [
        new Text('Nenhuma categoria adicionada. Use o painel acima para adicionar.', { type: 'p', class: 'pace-empty-hint' }),
      ];
      return;
    }

    const tabs = Array.from(categoryStates.entries()).map(([k, state]) => ({
      key: k,
      label: CATEGORY_LABELS[k],
      view: buildTabView(k, state),
    }));

    const selectedTabKey = pendingFocusKey && categoryStates.has(pendingFocusKey)
      ? pendingFocusKey
      : tabs[0].key;
    pendingFocusKey = null;

    const tabGroup = new TabGroup(tabs, { class: 'pace-category-tabs', selectedTabKey });
    tabGroupContainer.children = [tabGroup];
  }

  // Initial build
  buildTabGroupFresh();

  // -- Add-category controls --
  const addControls = canModify ? buildAddControls() : null;

  function buildAddControls() {
    // Persistent section title + a 2x3 grid of add-buttons that refreshes as
    // metrics are added/removed. Title stays even when all metrics are added.
    const btnsContainer = new Container([], { class: 'pace-add-btns pace-add-btns--grid' });
    const addContainer = new Container([
      new Text('Métricas', { type: 'h4', class: 'pace-form-section-title' }),
      btnsContainer,
    ], { class: 'pace-add-category-section' });

    function refreshAddControls() {
      const available = CATEGORY_KEYS.filter(k => !categoryStates.has(k));
      btnsContainer.children = available.map(k => new Button('+ ' + CATEGORY_LABELS[k], {
        variant: 'secondary',
        title: METRIC_DESCRIPTIONS[k] || '',
        onClickHandler: () => {
          const editabilityForNew = editability || { asIs: true, toBe: false };
          const state = createCategoryState(k, null, editabilityForNew);
          categoryStates.set(k, state);
          pendingFocusKey = k;
          changeCounter.value = (changeCounter.value || 0) + 1;
        },
      }));
    }

    refreshAddControls();

    // Subscribe to change counter to refresh add controls
    const unsub = changeCounter.subscribe(() => {
      refreshAddControls();
    });

    return { component: addContainer, unsub };
  }

  const buildAsIsTitle = () => new Text('Cálculos As-Is', { type: 'p', class: 'pace-totals-section-title' });
  const buildToBeTitle = () => new Text('Cálculos To-Be', { type: 'p', class: 'pace-totals-section-title' });

  function totalsAreaChildren() {
    const keys = Array.from(categoryStates.keys());
    if (!metricsHaveFinancialData(keys)) return [];
    return [
      buildAsIsTitle(), asIsTotalsResult.component,
      buildToBeTitle(), toBeTotalsResult.component,
      impactSummaryResult.component,
    ];
  }

  // Subscribe to counter to rebuild tabs and totals panels
  const tabUnsub = changeCounter.subscribe(() => {
    buildTabGroupFresh();
    asIsTotalsResult.dispose();
    toBeTotalsResult.dispose();
    impactSummaryResult.dispose();
    asIsTotalsResult = buildTotalsPanel(categoryStates, { phase: 'asIs', timePeriod, fteAnnualCost });
    toBeTotalsResult = buildTotalsPanel(categoryStates, { phase: 'toBe', timePeriod, fteAnnualCost });
    impactSummaryResult = buildImpactSummaryPanel(categoryStates, { timePeriod, fteAnnualCost });
    totalsAreaContainer.children = totalsAreaChildren();
  });
  unsubs.push(tabUnsub);
  if (addControls) unsubs.push(addControls.unsub);

  const totalsAreaContainer = new Container(totalsAreaChildren(), { class: 'pace-totals-area' });

  const mainChildren = [
    ...(addControls ? [addControls.component] : []),
    new Container([
      tabGroupContainer,
      totalsAreaContainer,
    ], { class: 'pace-tabs-totals-layout' }),
  ];

  const container = new Container(mainChildren, { class: 'pace-category-section' });

  function dispose() {
    unsubs.forEach(u => u && u());
    for (const r of builderResults.values()) r.dispose();
    builderResults.clear();
    asIsTotalsResult.dispose();
    toBeTotalsResult.dispose();
    impactSummaryResult.dispose();
    changeCounter.dispose();
  }

  return { container, changeCounter, rebuild: buildTabGroupFresh, dispose };
}
