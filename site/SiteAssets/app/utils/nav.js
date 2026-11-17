import { Container, Image, LinkButton } from '../libs/nofbiz/nofbiz.base.js';
import { isAdmin } from './auth.js';

// Returns a sticky nav bar with logo on the left and page links on the right.
// activePath matches the route key string ('', 'initiatives', 'admin', 'profile').
export function buildNavbar(user, activePath) {
  // Helper: build a styled nav link. activeKey defaults to path when omitted.
  const navLink = (label, path, activeKey = path) =>
    new LinkButton(label, path, {
      class: `app-nav__link${activePath === activeKey ? ' app-nav__link--active' : ''}`,
    });

  const logo = new Image('../SiteAssets/app/media/logo.svg', {
    class: 'app-nav__logo',
    alt: 'Volunteering Portal logo',
  });

  const brandGroup = new Container([logo], {
    class: 'app-nav__brand-group',
  });

  // TEMP: always show Admin link while testing. Remove to restore isAdmin gate.
  const SHOW_ADMIN_ALWAYS = true;

  const navLinks = [
    navLink('HomePage', '/', ''),
    navLink('Initiatives', 'initiatives'),
    navLink('My Profile', 'profile'),
  ];

  if (SHOW_ADMIN_ALWAYS || isAdmin(user)) {
    navLinks.push(navLink('Admin', 'admin'));
  }

  const inner = new Container(
    [brandGroup, new Container(navLinks, { class: 'app-nav__links' })],
    { class: 'app-nav__inner shell' },
  );

  return new Container([inner], { as: 'nav', class: 'app-nav' });
}
