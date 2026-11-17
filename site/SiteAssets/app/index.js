import {
  pageReset,
  Router,
  CurrentUser,
  resolvePath,
  StyleResource,
} from './libs/nofbiz/nofbiz.base.js';

await pageReset({
  themePath: resolvePath('@/libs/nofbiz/nofbiz.base.css'),
  clearConsole: false,
});

const appStyles = new StyleResource('@/css/styles.css');
await appStyles.ready;

const user = await new CurrentUser().initialize();

new Router([
  'admin',
  'initiatives',
  'initiatives/detail',
  'profile',
]);
