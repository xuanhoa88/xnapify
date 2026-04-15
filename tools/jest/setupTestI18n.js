/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// Encapsulates the i18next configuration used during testing.  This
// allows other scripts (for instance, individual test helper files)
// to import and reuse the same setup if necessary.

const i18n = require('i18next');
const { initReactI18next } = require('react-i18next');

function initI18nForTesting() {
  i18n.use(initReactI18next).init({
    lng: 'en-US',
    fallbackLng: 'en-US',
    ns: ['translation'],
    defaultNS: 'translation',
    resources: {
      'en-US': {
        translation: {
          test: 'Test',
        },
      },
    },
    interpolation: {
      escapeValue: false, // React already escapes
    },
    react: {
      useSuspense: false, // required for synchronous render in tests
    },
  });
}

module.exports = {
  initI18nForTesting,
  i18n,
};
