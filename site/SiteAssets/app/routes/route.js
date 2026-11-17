import {
  Text,
  Container,
  Image,
  LinkButton,
  Toast,
  SiteApi,
  CurrentUser,
  defineRoute,
  __lodash,
  escapeHtml,
} from '../libs/nofbiz/nofbiz.base.js';
import { buildNavbar } from '../utils/nav.js';
import { STATUSES } from '../utils/status.js';
import { loadSiteContent, toParagraphs } from '../utils/siteContent.js';
import { DOC_LIBRARY_TITLE, HOME_MEDIA_FOLDER, HOME_RESOURCES_FOLDER } from '../utils/constants.js';
import { listFolderFiles, buildFileUrl } from '../utils/documents.js';

export default defineRoute(async (config) => {
  config.setRouteTitle('Home');

  // Start all independent fetches before awaiting any -- eliminates sequential latency.
  // imageFileName depends on t, so imageSrcPromise is created after contentPromise resolves.
  const contentPromise = loadSiteContent('home.');
  // Logging .catch ensures the promise always resolves (null on failure) and
  // prevents UnhandledPromiseRejection while contentPromise is being awaited.
  const resourcesPromise = listFolderFiles(DOC_LIBRARY_TITLE, HOME_RESOURCES_FOLDER)
    .catch((err) => { console.error('[home] resources fetch failed', err); return null; });
  // Wrap into { items } / { err } so the existing catch block logs and toasts exactly once.
  const statsPromise = new SiteApi().list('Initiatives').getItems()
    .then((items) => ({ items }), (err) => ({ err }));

  const t = await contentPromise;
  const user = new CurrentUser();

  // imageFileName depends on t, so the image URL promise starts after content loads.
  const imageFileName = t.raw('home.about.image').trim();
  const imageSrcPromise = imageFileName
    ? buildFileUrl(DOC_LIBRARY_TITLE, HOME_MEDIA_FOLDER, imageFileName)
    : Promise.resolve('');

  // Hero band
  const hero = new Container(
    [
      new Container(
        [
          new Container(
            [
              new Text('Volunteering program', { type: 'span', class: 'eyebrow' }),
              new Text(
                t('home.hero.title'),
                { type: 'h1', class: 'hero__title' },
              ),
              new Text(
                t('home.hero.subtitle'),
                { type: 'p', class: 'hero__sub' },
              ),
              new LinkButton('Browse initiatives', 'initiatives', { variant: 'primary' }),
            ],
            { class: 'hero__inner' },
          ),
          new Image('../SiteAssets/app/media/hero.png', { class: 'hero__image', alt: 'Volunteering program' }),
        ],
        { class: 'shell' },
      ),
    ],
    { class: 'hero' },
  );

  // Carousel band -- 5 fixed slots with pure-CSS crossfade; no JS timer.
  // Each slot k holds 5 layers rotated by k: layer i = CAROUSEL_ITEMS[(i+k)%5].
  // CSS nth-child delay offsets make each slot's nth-child(1) the initial visible
  // layer. Over 5 steps every item occupies the big slot (slot 0) exactly once.
  const CAROUSEL_ITEMS = [
    {
      src: '../SiteAssets/app/media/carousel/slide-1.svg',
      title: 'Lorem ipsum dolor sit amet',
      description: 'Consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    },
    {
      src: '../SiteAssets/app/media/carousel/slide-2.svg',
      title: 'Sed do eiusmod tempor incididunt',
      description: 'Ut labore et dolore magna aliqua. Ut enim ad minim veniam quis nostrud exercitation ullamco.',
    },
    {
      src: '../SiteAssets/app/media/carousel/slide-3.svg',
      title: 'Consectetur adipiscing elit',
      description: 'Quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat duis aute.',
    },
    {
      src: '../SiteAssets/app/media/carousel/slide-4.svg',
      title: 'Ut labore et dolore magna',
      description: 'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla.',
    },
    {
      src: '../SiteAssets/app/media/carousel/slide-5.svg',
      title: 'Exercitation ullamco laboris',
      description: 'Nulla pariatur excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt.',
    },
  ];

  const buildLayer = (item) =>
    new Container(
      [
        new Image(item.src, { class: 'carousel-layer__img', alt: item.title }),
        new Container(
          [
            new Text(item.title, { type: 'span', class: 'carousel-layer__title' }),
            new Text(item.description, { type: 'p', class: 'carousel-layer__desc' }),
          ],
          { class: 'carousel-layer__overlay' },
        ),
      ],
      { class: 'carousel-layer' },
    );

  const buildSlot = (k, isBig = false) =>
    new Container(
      CAROUSEL_ITEMS.map((_, i) => buildLayer(CAROUSEL_ITEMS[(i + k) % CAROUSEL_ITEMS.length])),
      { class: isBig ? 'carousel-slot carousel-slot--big' : 'carousel-slot' },
    );

  const carouselGrid = new Container(
    [buildSlot(0, true), buildSlot(1), buildSlot(2), buildSlot(3), buildSlot(4)],
    { class: 'carousel-grid' },
  );
  const carouselBand = new Container(
    [new Container([carouselGrid], { class: 'shell' })],
    { class: 'carousel' },
  );

  // Await data needed for the intro band; stats keeps running in parallel.
  // Fall back to the bundled placeholder when no file name is configured or
  // when the library root cannot be resolved.
  const ABOUT_PLACEHOLDER = '../SiteAssets/app/media/about-placeholder.svg';
  let imageSrc = ABOUT_PLACEHOLDER;
  try {
    const resolved = await imageSrcPromise;
    imageSrc = resolved || ABOUT_PLACEHOLDER;
  } catch (err) {
    console.warn('[home] about image URL resolution failed', err);
  }

  // resourcesPromise always resolves (null on failure; error already logged above).
  const resourceFiles = await resourcesPromise;

  // ---- Resource card helpers ----

  const formatBytes = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const nameWithoutExt = (name) => {
    const dot = name.lastIndexOf('.');
    return dot > 0 ? name.slice(0, dot) : name;
  };

  const buildResourceCard = (r) => {
    const note = r.ext.toUpperCase() + (r.size ? ', ' + formatBytes(r.size) : '');
    return new Container(
      [
        new Container([], { class: 'resource-card__icon' }),
        new Container(
          [
            new Text(escapeHtml(nameWithoutExt(r.name)), { type: 'span', class: 'resource-card__title' }),
            new Text(note, { type: 'span', class: 'resource-card__note' }),
          ],
          { class: 'resource-card__text' },
        ),
      ],
      {
        class: 'resource-card surface',
        onClickHandler: () => window.open(r.url, '_blank', 'noopener'),
      },
    );
  };

  const resourceListItems = (() => {
    if (resourceFiles === null) {
      return [new Text('Resources are unavailable right now.', { type: 'p', class: 'intro__body' })];
    }
    if (resourceFiles.length === 0) {
      return [new Text('No resources available yet.', { type: 'p', class: 'intro__body' })];
    }
    return resourceFiles.map(buildResourceCard);
  })();

  // About image: always present -- shows placeholder when no file is configured.
  // The nofbiz__image wrapper stays at opacity:0 on a 404, keeping no broken box.
  const aboutImage = new Image(imageSrc, { class: 'intro__about-image', alt: '' });

  // Intro band -- rendered regardless of stats load outcome
  const introBand = new Container(
    [
      new Container(
        [
          new Container(
            [
              new Text('About the platform', { type: 'span', class: 'eyebrow' }),
              new Text(t('home.about.title'), { type: 'h2', class: 'section-title' }),
              ...toParagraphs(t('home.about.body')).map((p) => new Text(p, { type: 'p', class: 'intro__body' })),
              aboutImage,
            ],
            { class: 'intro__main surface' },
          ),
          new Container(
            [
              new Text('Resources', { type: 'h3', class: 'intro__aside-title' }),
              new Container(resourceListItems, { class: 'intro__aside-list' }),
            ],
            { class: 'intro__aside' },
          ),
        ],
        { class: 'intro__grid shell' },
      ),
    ],
    { class: 'intro' },
  );

  // Attempt to load stats. On failure render navbar + hero only.
  let figuresBand = null;
  try {
    const { items, err } = await statsPromise;
    if (err) throw err;

    const totalCount = items.length;

    const distinctAssociations = __lodash.uniqBy(
      items.filter((i) => i.AssociationName),
      (i) => String(i.AssociationName),
    ).length;

    const volunteersNeeded = items.reduce((sum, i) => {
      const n = Number(i.VolunteersNeeded);
      return Number.isNaN(n) ? sum : sum + n;
    }, 0);

    const openCount = items.filter((i) => String(i.Status) === STATUSES.OPEN).length;

    const makeFigure = (value, label) =>
      new Container(
        [
          new Text(String(value), { type: 'span', class: 'figure__value' }),
          new Text(label, { type: 'span', class: 'figure__label' }),
        ],
        { class: 'figure' },
      );

    const figuresGrid = new Container(
      [
        makeFigure(totalCount, 'Total initiatives'),
        makeFigure(distinctAssociations, 'Partner organisations'),
        makeFigure(volunteersNeeded, 'Volunteers needed'),
        makeFigure(openCount, 'Open initiatives'),
      ],
      { class: 'figures__grid' },
    );

    const figuresIntro = new Container(
      [
        new Text('Our impact in figures', { type: 'span', class: 'eyebrow' }),
        new Text(t('home.figures.title'), { type: 'h2', class: 'section-title' }),
        new Text(
          t('home.figures.lead'),
          { type: 'p', class: 'figures__lead' },
        ),
      ],
      { class: 'figures__intro' },
    );

    figuresBand = new Container(
      [
        new Container(
          [
            new Container([figuresIntro, figuresGrid], { class: 'figures__grid-wrap surface' }),
          ],
          { class: 'shell' },
        ),
      ],
      { class: 'figures' },
    );
  } catch (err) {
    console.error('[home] stats getItems failed:', err);
    Toast.error('Could not load platform statistics.');
  }

  const children = [buildNavbar(user, ''), hero, carouselBand, introBand];
  if (figuresBand) children.push(figuresBand);

  return children;
});
