// Single source of truth for site content defaults and placements.
// No imports -- must be loadable by Node without external dependencies.

export const SITE_CONTENT_LIST = 'SiteContent';

export const SITE_CONTENT = {
  'home.hero.title': {
    text: 'Our people give their time to causes that matter',
    placement: 'Home page > Hero > Headline',
  },
  'home.hero.subtitle': {
    text: 'Explore our volunteering program and join initiatives that create real change in communities.',
    placement: 'Home page > Hero > Text under the headline',
  },
  'home.about.title': {
    text: 'Give your time where it matters',
    placement: 'Home page > About the platform > Heading',
  },
  'home.about.body': {
    text: 'This platform brings our people together with volunteering initiatives run by partner organisations across the communities we serve. Browse open initiatives, find a cause that matches your skills and your schedule, and lend your time where it makes a real difference.\n\nEvery initiative explains what you will do, the skills involved, the time commitment, and how to take part. New opportunities are added regularly, so check back often or use the catalog to find the ones that fit you.',
    placement: 'Home page > About the platform > Body text (leave a blank line between paragraphs)',
  },
  'home.about.image': {
    text: '',
    placement: 'Home page > About the platform > Image file name (upload the image to Team Documents/media first; leaving blank shows the default placeholder image)',
  },
  'home.figures.title': {
    text: 'Volunteering at a glance',
    placement: 'Home page > Impact in figures > Heading',
  },
  'home.figures.lead': {
    text: 'These numbers reflect the collective effort of our people and the organisations we partner with. They grow as new initiatives open and more colleagues choose to take part.',
    placement: 'Home page > Impact in figures > Text under the heading',
  },
};
