/**
 * Mock SharePoint context for local development.
 * Provides the minimum _spPageContextInfo fields required by the SPARC framework.
 */
var _spPageContextInfo = {
  webAbsoluteUrl: `${location.origin}/site`,
  webTitle: 'SPARC Application',
  formDigestValue: '0x1234MOCK_DIGEST_VALUE_FOR_SANDBOX',
  formDigestTimeoutSeconds: 1800,
  userLoginName: 'i:0#.w|SANDBOX\\john.doe',
};

/**
 * Additional local-dev mock handlers for endpoints not covered by spInterceptor.js:
 *   - Document library root resolution (lists/getbytitle('.../RootFolder')
 *   - File listings (GetFolderByServerRelativeUrl)
 * These are registered in site/spMockHandlers.js, which is loaded after spInterceptor.js.
 * This file (sharepointContext.js) cannot reference SPInterceptor because it loads before it.
 */

/**
 * Mock data for SPInterceptor.
 * Define seed data here -- spInterceptor reads this on initialization.
 * This file is project-specific and NOT overwritten by update-environment.
 */
var _spMockData = {
  // Override default mock user identity (partial -- only specified fields are merged).
  // NOTE: this patches store.user only; CurrentUser's displayName/email come from the
  // profile properties (John Doe / john.doe@example.com), so seed data below is keyed
  // to that identity rather than overriding it here.
  // user: {
  //   Title: 'John Doe',
  //   Email: 'john.doe@example.com',
  // },

  // Override default mock user profile (partial -- deep merge)
  // profile: {
  //   Title: 'Software Developer',
  // },

  // Override default mock groups (full replacement)
  // groups: [
  //   { Id: 1, Title: 'App Members', Description: 'Members group', OwnerTitle: 'Admin' },
  //   { Id: 2, Title: 'App Owners', Description: 'Owners group', OwnerTitle: 'Admin' },
  // ],

  // Pre-populate SharePoint lists with seed data
  lists: {
    'UserProfiles': {
      items: [
        {
          Id: 1,
          Title: 'john.doe@example.com',
          Name: 'John Doe',
          UID: 'john.doe',
          // Work preferences
          WorkLocation: 'Lisbon',
          Entity: 'Digital & Technology',
          FullRemote: 'false',
          SkillsToDevelop: 'Public speaking, project management',
          PreferredArea: 'Lisbon',
          // Volunteering preferences
          VolunteeringExperience: '3 years',
          PreferredMissionType: 'One-Time Project',
          Availability: 'Weekend',
          AreaOfImpact: 'Improving local communities where we are located',
          CSRPillar: 'Environment',
          // Skills and interests (arrays stored as JSON strings)
          SDGs: '["Climate Action","Quality Education","Life on Land"]',
          Languages: '["English","Portuguese","Spanish"]',
          Hobbies: '["Hiking","Photography","Cooking"]',
          Certifications: '["First Aid","Scrum Master"]',
          Skills: '["Web development","Mentoring","Public speaking"]',
          Interests: 'Environmental sustainability and digital education for young people.',
          // Dietary preferences
          DietRequirements: 'Vegetarian, no nuts',
          MealsNeeded: 'Lunch on event days',
        },
      ],
      fields: [],
      nextId: 2,
    },

    'Initiatives': {
      items: [
        {
          Id: 1,
          Title: 'Green Roots Collective - Urban Tree Planting',
          AssociationName: 'Green Roots Collective',
          AssociationMission: 'A community group restoring green spaces in urban neighbourhoods.',
          AssociationWebsite: 'https://greenroots.example.org',
          PointOfContact: 'Maria Santos (maria.santos@greenroots.example.org)',
          MissionName: 'Urban Tree Planting',
          MissionDescription: 'Help plant native trees along city streets and small parks to expand shade and improve air quality. Volunteers dig, plant, mulch and water under guidance from local horticulturalists.',
          SDG1: 'Climate Action',
          SDG2: 'Life on Land',
          SDG3: '',
          SDGOther: '',
          StrategicPriority: 'Environment',
          MissionLocation: 'Parque das Nacoes, Lisbon',
          TransportationIncluded: 'No',
          VolunteerExpectations: 'Comfortable working outdoors for several hours. Closed shoes and weather-appropriate clothing required.',
          PhysicalVolunteering: 'Yes',
          Skill1: '',
          Skill2: '',
          Skill3: '',
          LanguageRequirements: 'Portuguese or English',
          SkillDev1: 'Basic horticulture',
          SkillDev2: 'Teamwork',
          SkillDev3: '',
          SkillDev4: '',
          MissionDuration: 'Half day',
          DurationNotes: '',
          PlannedDays: '2026-07-18',
          StartingTime: '09:00',
          EndingTime: '13:00',
          VolunteersNeeded: '30',
          HoursPerVolunteer: '4',
          RegistrationDeadline: '2026-07-11',
          Status: 'Open',
          RegistrationMode: 'Auto',
        },
        {
          Id: 2,
          Title: 'City Food Bank - Weekend Meal Packing',
          AssociationName: 'City Food Bank',
          AssociationMission: 'Collecting and distributing food to families facing hardship.',
          AssociationWebsite: 'https://cityfoodbank.example.org',
          PointOfContact: 'Tiago Pereira (tiago@cityfoodbank.example.org)',
          MissionName: 'Weekend Meal Packing',
          MissionDescription: 'Sort donated goods and assemble balanced food parcels for distribution to local families. Fast-paced and rewarding work in a warehouse setting.',
          SDG1: 'Zero Hunger',
          SDG2: 'No Poverty',
          SDG3: 'Partnerships for the Goals',
          SDGOther: '',
          StrategicPriority: 'Community',
          MissionLocation: 'Rua do Bolhao 25, Porto',
          TransportationIncluded: 'Yes',
          VolunteerExpectations: 'Able to stand and lift parcels up to 10 kg. Hairnets and gloves provided.',
          PhysicalVolunteering: 'Yes',
          Skill1: '',
          Skill2: '',
          Skill3: '',
          LanguageRequirements: 'Portuguese',
          SkillDev1: 'Logistics',
          SkillDev2: 'Food safety basics',
          SkillDev3: '',
          SkillDev4: '',
          MissionDuration: 'Half day',
          DurationNotes: '',
          PlannedDays: '2026-07-25',
          StartingTime: '10:00',
          EndingTime: '14:00',
          VolunteersNeeded: '20',
          HoursPerVolunteer: '4',
          RegistrationDeadline: '2026-07-20',
          Status: 'Open',
          RegistrationMode: 'Validation',
        },
        {
          Id: 3,
          Title: 'Code Forward - Digital Skills Workshop',
          AssociationName: 'Code Forward',
          AssociationMission: 'Teaching digital and coding skills to underserved young people.',
          AssociationWebsite: 'https://codeforward.example.org',
          PointOfContact: 'Ana Reis (ana.reis@codeforward.example.org)',
          MissionName: 'Digital Skills Workshop',
          MissionDescription: 'Lead small groups of teenagers through an introductory web development session. You will guide exercises, answer questions and share your professional experience.',
          SDG1: 'Quality Education',
          SDG2: 'Decent Work and Economic Growth',
          SDG3: '',
          SDGOther: '',
          StrategicPriority: 'Education',
          MissionLocation: 'Calle Gran Via 40, Madrid',
          TransportationIncluded: 'No',
          VolunteerExpectations: 'Patience working with beginners and clear communication.',
          PhysicalVolunteering: 'No',
          Skill1: 'Web development',
          Skill2: 'Teaching',
          Skill3: 'Public speaking',
          LanguageRequirements: 'Spanish or English',
          SkillDev1: 'Mentoring',
          SkillDev2: 'Facilitation',
          SkillDev3: '',
          SkillDev4: '',
          MissionDuration: 'Full day',
          DurationNotes: '',
          PlannedDays: '2026-08-01',
          StartingTime: '09:30',
          EndingTime: '17:00',
          VolunteersNeeded: '25',
          HoursPerVolunteer: '7',
          RegistrationDeadline: '2026-07-24',
          Status: 'Open',
          RegistrationMode: 'Auto',
        },
        {
          Id: 4,
          Title: 'Coastline Care - Beach Cleanup',
          AssociationName: 'Coastline Care',
          AssociationMission: 'Protecting coastal ecosystems through cleanups and awareness.',
          AssociationWebsite: 'https://coastlinecare.example.org',
          PointOfContact: 'Rui Costa (rui@coastlinecare.example.org)',
          MissionName: 'Beach Cleanup',
          MissionDescription: 'Join a team removing litter and plastics from the shoreline, sorting waste for recycling and recording data on what is collected.',
          SDG1: 'Life Below Water',
          SDG2: 'Climate Action',
          SDG3: 'Responsible Consumption and Production',
          SDGOther: '',
          StrategicPriority: 'Environment',
          MissionLocation: 'Praia do Guincho, Cascais',
          TransportationIncluded: 'Yes',
          VolunteerExpectations: 'Outdoor activity on sand; sun protection recommended.',
          PhysicalVolunteering: 'Yes',
          Skill1: '',
          Skill2: '',
          Skill3: '',
          LanguageRequirements: 'Portuguese or English',
          SkillDev1: 'Environmental monitoring basics',
          SkillDev2: '',
          SkillDev3: '',
          SkillDev4: '',
          MissionDuration: 'Half day',
          DurationNotes: '',
          PlannedDays: '2026-08-08',
          StartingTime: '08:30',
          EndingTime: '12:30',
          VolunteersNeeded: '30',
          HoursPerVolunteer: '4',
          RegistrationDeadline: '2026-08-01',
          Status: 'Open',
          RegistrationMode: 'Validation',
        },
        {
          Id: 5,
          Title: 'Bright Minds Mentoring - Student Mentoring',
          AssociationName: 'Bright Minds Mentoring',
          AssociationMission: 'Pairing professionals with students to support their studies and careers.',
          AssociationWebsite: 'https://brightminds.example.org',
          PointOfContact: 'Sofia Marques (sofia@brightminds.example.org)',
          MissionName: 'Student Mentoring',
          MissionDescription: 'Mentor a final-year student over several online sessions, offering guidance on study habits, career choices and confidence building.',
          SDG1: 'Quality Education',
          SDG2: 'Reduced Inequalities',
          SDG3: '',
          SDGOther: '',
          StrategicPriority: 'Education',
          MissionLocation: 'Online',
          TransportationIncluded: 'No',
          VolunteerExpectations: 'Commit to scheduled video calls and prepare lightly between sessions.',
          PhysicalVolunteering: 'No',
          Skill1: 'Mentoring',
          Skill2: 'Active listening',
          Skill3: '',
          LanguageRequirements: 'English',
          SkillDev1: 'Coaching',
          SkillDev2: 'Empathy',
          SkillDev3: '',
          SkillDev4: '',
          MissionDuration: 'Ongoing',
          DurationNotes: '',
          PlannedDays: 'Weekly, flexible',
          StartingTime: '18:00',
          EndingTime: '19:00',
          VolunteersNeeded: '25',
          HoursPerVolunteer: '8',
          RegistrationDeadline: '2026-07-31',
          Status: 'Open',
          RegistrationMode: 'Auto',
        },
        {
          Id: 6,
          Title: 'Shelter Hands - Shelter Renovation Day',
          AssociationName: 'Shelter Hands',
          AssociationMission: 'Improving living conditions in shelters and transitional housing.',
          AssociationWebsite: 'https://shelterhands.example.org',
          PointOfContact: 'Pedro Alves (pedro@shelterhands.example.org)',
          MissionName: 'Shelter Renovation Day',
          MissionDescription: 'Repaint rooms, assemble furniture and carry out small repairs to refresh a shelter for families in transition.',
          SDG1: 'Sustainable Cities and Communities',
          SDG2: 'No Poverty',
          SDG3: '',
          SDGOther: '',
          StrategicPriority: 'Community',
          MissionLocation: 'Carrer de Sants 120, Barcelona',
          TransportationIncluded: 'No',
          VolunteerExpectations: 'Light manual work; tools and materials provided.',
          PhysicalVolunteering: 'Yes',
          Skill1: 'Painting',
          Skill2: 'DIY',
          Skill3: '',
          LanguageRequirements: 'Spanish or Catalan',
          SkillDev1: 'Basic renovation skills',
          SkillDev2: '',
          SkillDev3: '',
          SkillDev4: '',
          MissionDuration: 'Full day',
          DurationNotes: '',
          PlannedDays: '2026-05-30',
          StartingTime: '09:00',
          EndingTime: '17:00',
          VolunteersNeeded: '15',
          HoursPerVolunteer: '7',
          RegistrationDeadline: '2026-05-23',
          Status: 'Closed',
          RegistrationMode: 'Validation',
        },
        {
          Id: 7,
          Title: 'Silver Companions - Companionship Visits',
          AssociationName: 'Silver Companions',
          AssociationMission: 'Reducing isolation among older people through regular visits.',
          AssociationWebsite: 'https://silvercompanions.example.org',
          PointOfContact: 'Ines Lopes (ines@silvercompanions.example.org)',
          MissionName: 'Companionship Visits',
          MissionDescription: 'Spend time with residents at a care home, sharing conversation, games and a friendly presence.',
          SDG1: 'Good Health and Well-being',
          SDG2: 'Reduced Inequalities',
          SDG3: '',
          SDGOther: '',
          StrategicPriority: 'Community',
          MissionLocation: 'Avenida da Liberdade 200, Braga',
          TransportationIncluded: 'No',
          VolunteerExpectations: 'Warm, patient and respectful manner with older adults.',
          PhysicalVolunteering: 'Yes',
          Skill1: '',
          Skill2: '',
          Skill3: '',
          LanguageRequirements: 'Portuguese',
          SkillDev1: 'Interpersonal skills',
          SkillDev2: 'Care awareness',
          SkillDev3: '',
          SkillDev4: '',
          MissionDuration: 'Half day',
          DurationNotes: '',
          PlannedDays: '2026-06-13',
          StartingTime: '14:00',
          EndingTime: '17:00',
          VolunteersNeeded: '25',
          HoursPerVolunteer: '3',
          RegistrationDeadline: '2026-06-06',
          Status: 'Cancelled',
          RegistrationMode: 'Auto',
        },
        {
          Id: 8,
          Title: 'River Guardians - River Cleanup and Monitoring',
          AssociationName: 'River Guardians',
          AssociationMission: 'Protecting rivers through cleanups and water quality monitoring.',
          AssociationWebsite: 'https://riverguardians.example.org',
          PointOfContact: 'Carla Nunes (carla@riverguardians.example.org)',
          MissionName: 'River Cleanup and Monitoring',
          MissionDescription: 'Remove waste from riverbanks and help take simple water quality measurements that feed into a regional monitoring programme.',
          SDG1: 'Clean Water and Sanitation',
          SDG2: 'Climate Action',
          SDG3: 'Life Below Water',
          SDGOther: '',
          StrategicPriority: 'Environment',
          MissionLocation: 'Paseo de Guadalquivir, Seville',
          TransportationIncluded: 'Yes',
          VolunteerExpectations: 'Outdoor work near water; waders and gloves provided.',
          PhysicalVolunteering: 'No',
          Skill1: 'Data collection',
          Skill2: 'Environmental science',
          Skill3: '',
          LanguageRequirements: 'Spanish or English',
          SkillDev1: 'Field sampling techniques',
          SkillDev2: '',
          SkillDev3: '',
          SkillDev4: '',
          MissionDuration: 'Full day',
          DurationNotes: '',
          PlannedDays: '2026-05-16',
          StartingTime: '09:00',
          EndingTime: '16:00',
          VolunteersNeeded: '18',
          HoursPerVolunteer: '6',
          RegistrationDeadline: '2026-05-09',
          Status: 'Closed',
          RegistrationMode: 'Validation',
        },
      ],
      fields: [],
      nextId: 9,
    },

    'Registrations': (function () {
      // -----------------------------------------------------------------------
      // Deterministic registration generator.
      //
      // Name pool: 30 first names x 30 last names (900 combinations).
      // For initiative index i, volunteer index j:
      //   firstName = firstNames[(i * 10 + j) % 30]   -- unique within 30 slots
      //   lastName  = lastNames[(i * 7 + j * 3) % 30]
      // Within a single initiative (j < 30), firstName is always unique, so
      // emails are unique per initiative. Across initiatives the same email
      // may appear, meaning the same volunteer joined multiple events.
      // -----------------------------------------------------------------------
      var firstNames = [
        'Alex', 'Blake', 'Casey', 'Dana', 'Drew',
        'Ellis', 'Fiona', 'Graham', 'Harper', 'Isla',
        'Jordan', 'Kelly', 'Liam', 'Morgan', 'Nadia',
        'Owen', 'Parker', 'Quinn', 'Riley', 'Sam',
        'Taylor', 'Uma', 'Victor', 'Wade', 'Xena',
        'Yara', 'Zach', 'Avery', 'Brooke', 'Chris',
      ];
      var lastNames = [
        'Adams', 'Baker', 'Clark', 'Davis', 'Evans',
        'Foster', 'Green', 'Harris', 'Inge', 'Jones',
        'King', 'Lewis', 'Moore', 'Nash', 'Owen',
        'Park', 'Quinn', 'Reed', 'Smith', 'Turner',
        'Upton', 'Vega', 'Ward', 'Xiao', 'York',
        'Zhao', 'Allen', 'Brown', 'Cole', 'Dean',
      ];
      // Dietary cycle: mostly empty, with occasional preferences (period 20).
      var dietaryCycle = [
        [], [], [], ['Vegetarian'], [], ['Vegan'], [], [], ['Gluten-free'], [],
        [], ['Halal'], [], [], [], ['Lactose-free'], [], [], ['Nut allergy'], [],
      ];
      // Notes cycle: mostly empty (period 10).
      var notesCycle = [
        '', '', '', '', '', '', '', '', '', '',
        'Looking forward to it', '', '', '', '', '', '', '', '', '',
      ];
      // Transport cycle: roughly 30% yes (period 10).
      var transportCycle = [
        'false', 'true', 'false', 'false', 'true',
        'false', 'false', 'true', 'false', 'false',
      ];

      // Initiative definitions (index matches Initiatives list Id - 1).
      // Auto: all rows Accepted, VolunteersNeeded >= total.
      // Validation: accepted rows <= VolunteersNeeded, pending = total - accepted.
      var initiatives = [
        { id: 1, title: 'Green Roots Collective - Urban Tree Planting',    mode: 'Auto',       total: 25, accepted: 25 },
        { id: 2, title: 'City Food Bank - Weekend Meal Packing',           mode: 'Validation', total: 22, accepted: 15 },
        { id: 3, title: 'Code Forward - Digital Skills Workshop',          mode: 'Auto',       total: 22, accepted: 22 },
        { id: 4, title: 'Coastline Care - Beach Cleanup',                  mode: 'Validation', total: 28, accepted: 22 },
        { id: 5, title: 'Bright Minds Mentoring - Student Mentoring',      mode: 'Auto',       total: 20, accepted: 20 },
        { id: 6, title: 'Shelter Hands - Shelter Renovation Day',          mode: 'Validation', total: 21, accepted: 13 },
        { id: 7, title: 'Silver Companions - Companionship Visits',        mode: 'Auto',       total: 24, accepted: 24 },
        { id: 8, title: 'River Guardians - River Cleanup and Monitoring',  mode: 'Validation', total: 23, accepted: 16 },
      ];

      var items = [];
      var nextId = 1;

      // John Doe is always the first Accepted registration for initiative 1 (id=1).
      // The profile page depends on this email being registered and Accepted.
      items.push({
        Id: nextId++,
        Title: 'John Doe - Green Roots Collective - Urban Tree Planting',
        InitiativeId: '1',
        InitiativeTitle: 'Green Roots Collective - Urban Tree Planting',
        UserEmail: 'john.doe@example.com',
        UserName: 'John Doe',
        TransportNeeded: 'false',
        DietaryPreferences: ['Vegetarian', 'Nut allergy'],
        Notes: '',
        Status: 'Accepted',
      });

      for (var i = 0; i < initiatives.length; i++) {
        var init = initiatives[i];
        // For initiative id=1 (i=0), John Doe occupies slot j=0 -- start from j=1.
        var startJ = (init.id === 1) ? 1 : 0;

        for (var j = startJ; j < init.total; j++) {
          var fnIdx = (i * 10 + j) % firstNames.length;
          var lnIdx = (i * 7 + j * 3) % lastNames.length;
          var fn = firstNames[fnIdx];
          var ln = lastNames[lnIdx];
          var email = fn.toLowerCase() + '.' + ln.toLowerCase() + '@company.com';
          // Auto: all Accepted. Validation: first `accepted` slots are Accepted, rest Pending.
          var status = (init.mode === 'Auto' || j < init.accepted) ? 'Accepted' : 'Pending';

          items.push({
            Id: nextId++,
            Title: fn + ' ' + ln + ' - ' + init.title,
            InitiativeId: String(init.id),
            InitiativeTitle: init.title,
            UserEmail: email,
            UserName: fn + ' ' + ln,
            TransportNeeded: transportCycle[j % transportCycle.length],
            DietaryPreferences: dietaryCycle[j % dietaryCycle.length],
            Notes: notesCycle[j % notesCycle.length],
            Status: status,
          });
        }
      }

      return { items: items, fields: [], nextId: nextId };
    })(),

    // SiteContent is intentionally empty -- local dev shows defaults.
    // To test an override, run: SPInterceptor.store.lists.SiteContent.items.push({ Id: 1, Title: 'home.hero.title', Content: 'Your custom headline', Placement: '' })
    'SiteContent': { items: [], fields: [], nextId: 1 },
  },
};
