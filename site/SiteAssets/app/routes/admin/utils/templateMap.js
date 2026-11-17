import { __zod as z } from '../../../libs/nofbiz/nofbiz.base.js';
import { excelSerialToISO } from './excelDate.js';

/** Column letter that holds the values to read. Labels in column B are display-only. */
export const VALUE_COL = 'C';

/**
 * Section groups for the import preview UI. Order here drives render order.
 * Each TEMPLATE_FIELDS entry references a section by `key`.
 */
export const SECTIONS = [
  { key: 'association', title: 'Association' },
  { key: 'overview',    title: 'Mission Overview' },
  { key: 'logistics',   title: 'Location & Logistics' },
  { key: 'volunteers',  title: 'Volunteer Requirements' },
  { key: 'schedule',    title: 'Schedule' },
];

/**
 * Cell-addressed map from Excel template to SharePoint fields.
 * Add a new field by appending a single entry below.
 *
 * - `section`: which preview group this field belongs to (must match SECTIONS key).
 * - `spField`: internal SP field name (must match setup/schema.js).
 * - `cell`: A1 address in the value column (e.g. 'C9'). Authoritative lookup key.
 * - `label`: human-readable label for the preview UI (display only).
 * - `transform`: optional function applied to the raw cell value.
 * - `schema`: Zod schema for validation. Lenient by default; tighten per field as needed.
 */
export const TEMPLATE_FIELDS = [
  { section: 'association', spField: 'AssociationName',         cell: 'C9',  label: 'Association Name',                  schema: z.any() },
  { section: 'association', spField: 'AssociationMission',      cell: 'C10', label: 'Association Mission',               schema: z.any() },
  { section: 'association', spField: 'AssociationWebsite',      cell: 'C11', label: 'Association Website',               schema: z.any() },
  // C12 intentionally skipped per template layout
  { section: 'association', spField: 'PointOfContact',          cell: 'C13', label: 'Point of Contact',                  schema: z.any() },

  { section: 'overview',    spField: 'MissionName',             cell: 'C16', label: 'Mission Name',                      schema: z.any() },
  { section: 'overview',    spField: 'MissionDescription',      cell: 'C17', label: 'Mission Description',               schema: z.any() },
  { section: 'overview',    spField: 'SDG1',                    cell: 'C19', label: 'SDG 1',                             schema: z.any() },
  { section: 'overview',    spField: 'SDG2',                    cell: 'C20', label: 'SDG 2',                             schema: z.any() },
  { section: 'overview',    spField: 'SDG3',                    cell: 'C21', label: 'SDG 3',                             schema: z.any() },
  { section: 'overview',    spField: 'SDGOther',                cell: 'C22', label: 'SDG (other / free text)',            schema: z.any() },
  { section: 'overview',    spField: 'StrategicPriority',       cell: 'C23', label: 'Strategic Priority (impact area)',   schema: z.any() },

  { section: 'logistics',   spField: 'MissionLocation',         cell: 'C25', label: 'Location / Address',                schema: z.any() },
  { section: 'logistics',   spField: 'TransportationIncluded',  cell: 'C26', label: 'Transportation Included',           schema: z.any() },

  { section: 'volunteers',  spField: 'VolunteerExpectations',   cell: 'C27', label: 'Volunteer Expectations',            schema: z.any() },
  { section: 'volunteers',  spField: 'PhysicalVolunteering',    cell: 'C28', label: 'Physical / Hands-on Volunteering',  schema: z.any() },
  { section: 'volunteers',  spField: 'Skill1',                  cell: 'C31', label: 'Skill 1',                           schema: z.any() },
  { section: 'volunteers',  spField: 'Skill2',                  cell: 'C32', label: 'Skill 2',                           schema: z.any() },
  { section: 'volunteers',  spField: 'Skill3',                  cell: 'C33', label: 'Skill 3',                           schema: z.any() },
  { section: 'volunteers',  spField: 'LanguageRequirements',    cell: 'C34', label: 'Language Requirements',             schema: z.any() },
  { section: 'volunteers',  spField: 'SkillDev1',               cell: 'C35', label: 'Skill to be Developed 1',           schema: z.any() },
  { section: 'volunteers',  spField: 'SkillDev2',               cell: 'C36', label: 'Skill to be Developed 2',           schema: z.any() },
  { section: 'volunteers',  spField: 'SkillDev3',               cell: 'C37', label: 'Skill to be Developed 3',           schema: z.any() },
  { section: 'volunteers',  spField: 'SkillDev4',               cell: 'C38', label: 'Skill to be Developed 4',           schema: z.any() },

  { section: 'schedule',    spField: 'MissionDuration',         cell: 'C39', label: 'Mission Duration',                  schema: z.any() },
  { section: 'schedule',    spField: 'DurationNotes',           cell: 'C40', label: 'Duration Notes',                    schema: z.any() },
  { section: 'schedule',    spField: 'PlannedDays',             cell: 'C41', label: 'Planned Days',                      schema: z.any() },
  { section: 'schedule',    spField: 'StartingTime',            cell: 'C42', label: 'Starting Time',   transform: excelSerialToISO, schema: z.any() },
  { section: 'schedule',    spField: 'EndingTime',              cell: 'C43', label: 'Ending Time',     transform: excelSerialToISO, schema: z.any() },
  { section: 'schedule',    spField: 'VolunteersNeeded',        cell: 'C44', label: 'Volunteers Needed',                 schema: z.any() },
  { section: 'schedule',    spField: 'HoursPerVolunteer',       cell: 'C45', label: 'Hours Per Volunteer',               schema: z.any() },
  // NOTE: C46 is assumed for RegistrationDeadline -- confirm the actual cell address with the template owner
  { section: 'schedule',    spField: 'RegistrationDeadline',    cell: 'C46', label: 'Registration Deadline', transform: excelSerialToISO, schema: z.any() },
];

/**
 * Build a Zod object schema from TEMPLATE_FIELDS for validating an assembled draft.
 * @returns {import('zod').ZodObject<any>}
 */
export function buildItemSchema() {
  const shape = {};
  for (const field of TEMPLATE_FIELDS) {
    shape[field.spField] = field.schema;
  }
  return z.object(shape);
}
