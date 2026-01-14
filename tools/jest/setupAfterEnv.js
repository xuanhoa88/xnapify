/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Jest setup file that runs after the test environment is set up
 * but before each test file is executed.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

/**
 * Initialize i18next for testing environment
 * Uses minimal configuration with test translations
 */
i18n.use(initReactI18next).init({
  lng: 'en-US',
  fallbackLng: 'en-US',
  ns: ['translation'],
  defaultNS: 'translation',
  resources: {
    'en-US': {
      translation: {
        // Add test translations here if needed
        test: 'Test',
      },
    },
  },
  interpolation: {
    escapeValue: false, // React already escapes
  },
  react: {
    useSuspense: false, // Required for testing
  },
});
