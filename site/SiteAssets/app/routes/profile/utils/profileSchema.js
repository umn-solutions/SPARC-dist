import {
  FormField,
  FormSchema,
  ComboBox,
  Toast,
} from '../../../libs/nofbiz/nofbiz.base.js';

// ---------------------------------------------------------------------------
// Option datasets -- single source of truth for all profile select controls.
// ---------------------------------------------------------------------------

export const WORK_LOCATIONS = ['Lisbon', 'Porto'];

export const SDG_GOALS = [
  'No Poverty',
  'Zero Hunger',
  'Good Health and Well-being',
  'Quality Education',
  'Gender Equality',
  'Clean Water and Sanitation',
  'Affordable and Clean Energy',
  'Decent Work and Economic Growth',
  'Industry, Innovation and Infrastructure',
  'Reduced Inequalities',
  'Sustainable Cities and Communities',
  'Responsible Consumption and Production',
  'Climate Action',
  'Life Below Water',
  'Life on Land',
  'Peace, Justice and Strong Institutions',
  'Partnerships for the Goals',
];

export const LANGUAGES = [
  'English',
  'Portuguese',
  'Spanish',
  'French',
  'German',
  'Italian',
  'Dutch',
  'Polish',
  'Russian',
  'Mandarin',
  'Arabic',
  'Japanese',
  'Korean',
  'Hindi',
  'Swedish',
  'Norwegian',
  'Danish',
  'Finnish',
  'Turkish',
  'Greek',
  'Czech',
  'Hungarian',
  'Romanian',
  'Ukrainian',
];

export const VOLUNTEERING_EXPERIENCE = [
  'Less than a year',
  '3 years',
  'More than 5 years',
];

export const MISSION_TYPES = [
  'All',
  'One-Time Project',
  'On a regular basis, up to 3 sessions',
  'On a regular basis, up to 10 sessions',
  'On a regular basis, +10 sessions',
];

export const AVAILABILITY = ['Week Day', 'Weekend', 'Both'];

export const AREAS_OF_IMPACT = [
  'Promoting the social inclusion of young people',
  'Accelerating the energy transition and fostering the preservation of biodiversity',
  'Supporting social entrepreneurship initiatives',
  'Improving local communities where we are located',
];

export const CSR_PILLARS = [
  'Diversity Equity Inclusion',
  'Environment',
  'Social/Civic',
];

// ---------------------------------------------------------------------------
// Helpers to convert stored string values to ComboBox option objects.
// ---------------------------------------------------------------------------

const toOption = (s) => ({ label: String(s), value: String(s) });
const toOptions = (arr) => (Array.isArray(arr) ? arr.map(toOption) : []);
const toOptionOrNull = (s) => (s ? { label: String(s), value: String(s) } : null);

// ---------------------------------------------------------------------------
// buildProfileSchema
//
// Builds one FormField per input pre-filled from `record` (the loaded SP item
// or null for a first-time user), then wraps them in a FormSchema.
//
// Returns { schema: FormSchema, fields: Record<string, FormField> }.
// ---------------------------------------------------------------------------

export function buildProfileSchema(record) {
  const fields = {
    WorkLocation: new FormField({
      value: toOptionOrNull(record?.WorkLocation),
    }),
    Entity: new FormField({
      value: record?.Entity || '',
    }),
    SDGs: new FormField({
      value: toOptions(record?.SDGs),
      validatorCallback: (v) => !Array.isArray(v) || v.length <= 3,
    }),
    Languages: new FormField({
      value: toOptions(record?.Languages),
    }),
    VolunteeringExperience: new FormField({
      value: toOptionOrNull(record?.VolunteeringExperience),
    }),
    Hobbies: new FormField({
      value: Array.isArray(record?.Hobbies) ? record.Hobbies : [],
    }),
    Certifications: new FormField({
      value: Array.isArray(record?.Certifications) ? record.Certifications : [],
    }),
    Skills: new FormField({
      value: Array.isArray(record?.Skills) ? record.Skills : [],
    }),
    Interests: new FormField({
      value: record?.Interests || '',
    }),
    DietRequirements: new FormField({
      value: record?.DietRequirements || '',
    }),
    MealsNeeded: new FormField({
      value: record?.MealsNeeded || '',
    }),
    PreferredMissionType: new FormField({
      value: toOptionOrNull(record?.PreferredMissionType),
    }),
    Availability: new FormField({
      value: toOptionOrNull(record?.Availability),
    }),
    SkillsToDevelop: new FormField({
      value: record?.SkillsToDevelop || '',
    }),
    PreferredArea: new FormField({
      value: record?.PreferredArea || '',
    }),
    FullRemote: new FormField({
      value: record?.FullRemote === true || record?.FullRemote === 'true',
    }),
    AreaOfImpact: new FormField({
      value: toOptionOrNull(record?.AreaOfImpact),
    }),
    CSRPillar: new FormField({
      value: toOptionOrNull(record?.CSRPillar),
    }),
  };

  const schema = new FormSchema(fields);
  return { schema, fields };
}

// ---------------------------------------------------------------------------
// buildCappedCombo
//
// Returns a multi-select ComboBox whose onSelectHandler enforces a maximum
// number of selections (there is no built-in max prop on ComboBox).
// When the cap is exceeded the selection is trimmed back to `max` items and
// a warning Toast is shown.
// ---------------------------------------------------------------------------

export function buildCappedCombo(field, dataset, max, props) {
  return new ComboBox(field, dataset, {
    allowMultiple: true,
    allowFiltering: true,
    ...props,
    onSelectHandler: (selection) => {
      const sel = Array.isArray(selection) ? selection : [];
      if (sel.length > max) {
        Toast.warning(`You can select up to ${max} options.`);
        // Defer the trim to avoid mutating field mid-handler.
        setTimeout(() => {
          field.value = sel.slice(0, max);
        }, 0);
      }
    },
  });
}
