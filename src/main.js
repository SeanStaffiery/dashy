/* eslint-disable no-multi-spaces */
// Import core framework and essential utils
import { createApp } from 'vue';
import { createI18n } from 'vue-i18n'; // i18n for localization

// Import component Vue plugins, used throughout the app
import VTooltip from 'v-tooltip';       // A Vue directive for Popper.js, tooltip component
import VModal from 'vue-js-modal';      // Modal component
import VSelect from 'vue-select';       // Select dropdown component
import VTabs from 'vue-material-tabs';  // Tab view component, used on the config page
import Toasted from 'vue-toasted';      // Toast component, used to show confirmation notifications
import TreeView from 'vue-json-tree-view';

// Import base Dashy components and utils
import Dashy from '@/App.vue';          // Main Dashy Vue app
import store from '@/store';            // Store, for local state management
import router from '@/router';          // Router, for navigation
import serviceWorker from '@/utils/InitServiceWorker'; // Service worker initialization
import { messages } from '@/utils/languages';         // Language texts
import ErrorReporting from '@/utils/ErrorReporting';  // Error reporting initializer (off)
import clickOutside from '@/directives/ClickOutside'; // Directive for closing popups, modals, etc
import { toastedOptions, tooltipOptions, language as defaultLanguage } from '@/utils/defaults';
import { initKeycloakAuth, isKeycloakEnabled } from '@/utils/KeycloakAuth';
import { initHeaderAuth, isHeaderAuthEnabled } from '@/utils/HeaderAuth';
import { initOidcAuth, isOidcEnabled } from '@/utils/OidcAuth';
import Keys from '@/utils/StoreMutations';
import ErrorHandler from '@/utils/ErrorHandler';

// When running in dev mode, enable Vue performance tools
const isDevMode = process.env.NODE_ENV === 'development';

// Setup i18n translations (vue-i18n v9)
const i18n = createI18n({
  locale: defaultLanguage,
  fallbackLocale: defaultLanguage,
  messages,
});

// Create app and register plugins
const app = createApp(Dashy);

app.use(store);
app.use(router);
app.use(i18n);

app.use(VTooltip, tooltipOptions);
app.use(VModal);
app.use(VTabs);
app.use(TreeView);
app.use(Toasted, toastedOptions);

app.component('v-select', VSelect);
app.directive('clickOutside', clickOutside);

// Vue 3 config flags
if (isDevMode) {
  app.config.performance = true;
}

// Checks if service worker not disable, and if so will registers it
serviceWorker();

// Checks if user enabled error reporting, and if so will initialize it
ErrorReporting(app, router);

// Mount helper
const mount = () => app.mount('#app');

// Initialize configuration and then mount with any required authentication
store.dispatch(Keys.INITIALIZE_CONFIG).then(() => {
  if (isOidcEnabled()) {
    initOidcAuth()
      .then(() => mount())
      .catch((e) => {
        ErrorHandler('Failed to authenticate with OIDC', e);
      });
  } else if (isKeycloakEnabled()) { // If Keycloak is enabled, initialize auth
    initKeycloakAuth()
      .then(() => mount())
      .catch((e) => {
        ErrorHandler('Failed to authenticate with Keycloak', e);
      });
  } else if (isHeaderAuthEnabled()) { // If header auth is enabled, initialize auth
    initHeaderAuth()
      .then(() => mount())
      .catch((e) => {
        ErrorHandler('Failed to authenticate with server', e);
      });
  } else { // If no third-party auth, just mount the app as normal
    mount();
  }
});
