// Schema -- the ONLY file to edit per project.
// Define your app's lists and fields here.
// This file is project-specific and NOT overwritten by update-environment.

export const APP_URL = new URL(_spPageContextInfo.webAbsoluteUrl).pathname + '/SitePages/index.html';

export const SCHEMA = {
  'UserProfiles': [
    { title: 'Title', indexed: true, builtIn: true },
    { title: 'Name' },
    { title: 'UID', indexed: true },
    { title: 'WorkLocation' },
    { title: 'Entity' },
    { title: 'SDGs', multiline: true },
    { title: 'Languages', multiline: true },
    { title: 'VolunteeringExperience' },
    { title: 'Hobbies', multiline: true },
    { title: 'Certifications', multiline: true },
    { title: 'Skills', multiline: true },
    { title: 'Interests', multiline: true },
    { title: 'DietRequirements', multiline: true },
    { title: 'MealsNeeded', multiline: true },
    { title: 'PreferredMissionType' },
    { title: 'Availability' },
    { title: 'SkillsToDevelop' },
    { title: 'PreferredArea' },
    { title: 'FullRemote' },
    { title: 'AreaOfImpact' },
    { title: 'CSRPillar' },
  ],

  'Initiatives': [
    { title: 'Title', indexed: true, builtIn: true },

    { title: 'AssociationName', indexed: true },
    { title: 'AssociationMission', multiline: true },
    { title: 'AssociationWebsite' },
    { title: 'PointOfContact' },

    { title: 'MissionName', indexed: true },
    { title: 'MissionDescription', multiline: true },
    { title: 'SDG1' },
    { title: 'SDG2' },
    { title: 'SDG3' },
    { title: 'SDGOther' },
    { title: 'StrategicPriority' },

    { title: 'MissionLocation' },
    { title: 'TransportationIncluded' },

    { title: 'VolunteerExpectations', multiline: true },
    { title: 'PhysicalVolunteering' },
    { title: 'Skill1' },
    { title: 'Skill2' },
    { title: 'Skill3' },
    { title: 'LanguageRequirements' },
    { title: 'SkillDev1' },
    { title: 'SkillDev2' },
    { title: 'SkillDev3' },
    { title: 'SkillDev4' },

    { title: 'MissionDuration' },
    { title: 'DurationNotes' },
    { title: 'PlannedDays' },
    { title: 'StartingTime' },
    { title: 'EndingTime' },
    { title: 'VolunteersNeeded' },
    { title: 'HoursPerVolunteer' },
    { title: 'RegistrationDeadline', indexed: true },
    { title: 'Status', indexed: true },
    { title: 'RegistrationMode' },
  ],

  'Registrations': [
    { title: 'Title', indexed: true, builtIn: true },
    { title: 'InitiativeId', indexed: true },
    { title: 'InitiativeTitle' },
    { title: 'UserEmail', indexed: true },
    { title: 'UserName' },
    { title: 'TransportNeeded' },
    { title: 'DietaryPreferences', multiline: true }, // JSON array of dietary options (multi-select)
    { title: 'Notes', multiline: true },
    { title: 'Status', indexed: true },
  ],

  // Editors maintain this list natively via the SharePoint interface.
  // After Full Setup or any site-wide toggle, on the SiteContent card:
  //   re-run Show list, Enable quick edit, Remove form redirect.
  'SiteContent': [
    { title: 'Title', indexed: true, builtIn: true },
    { title: 'Content', multiline: true },
    { title: 'Placement' },
  ],
};

// Built-in SP fields to ignore when computing EXTRA
export const BUILTIN_FIELDS = new Set([
  'ContentType', 'Title', 'Attachments', 'Modified', 'Created',
  'Author', 'Editor', 'ContentTypeId', 'ComplianceAssetId',
  'OData__UIVersionString', 'AppAuthor', 'AppEditor',
]);
