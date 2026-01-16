/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  getLocale,
  isLocaleLoading,
  getLoadingLocale,
  getLocaleFallback,
  hasLocaleFallback,
  getAvailableLocales,
  getAvailableLocaleCodes,
  isLocaleAvailable,
  getLocaleDisplayName,
  getCurrentLocaleDisplayName,
} from './selector';

describe('[intl] selector.js', () => {
  describe('getLocale', () => {
    it('should return current locale', () => {
      const state = {
        intl: {
          locale: 'fr-FR',
          localeLoading: null,
          localeFallback: null,
          availableLocales: {},
        },
      };
      expect(getLocale(state)).toBe('fr-FR');
    });

    it('should return default locale when state is empty', () => {
      const state = { intl: {} };
      const result = getLocale(state);
      expect(result).toBe('en-US'); // Default from normalizeState
    });
  });

  describe('isLocaleLoading', () => {
    it('should return true when locale is loading', () => {
      const state = {
        intl: {
          locale: 'en-US',
          localeLoading: 'fr-FR',
          localeFallback: null,
          availableLocales: {},
        },
      };
      expect(isLocaleLoading(state)).toBe(true);
    });

    it('should return false when locale is not loading', () => {
      const state = {
        intl: {
          locale: 'en-US',
          localeLoading: null,
          localeFallback: null,
          availableLocales: {},
        },
      };
      expect(isLocaleLoading(state)).toBe(false);
    });
  });

  describe('getLoadingLocale', () => {
    it('should return loading locale code', () => {
      const state = {
        intl: {
          locale: 'en-US',
          localeLoading: 'fr-FR',
          localeFallback: null,
          availableLocales: {},
        },
      };
      expect(getLoadingLocale(state)).toBe('fr-FR');
    });

    it('should return null when no locale is loading', () => {
      const state = {
        intl: {
          locale: 'en-US',
          localeLoading: null,
          localeFallback: null,
          availableLocales: {},
        },
      };
      expect(getLoadingLocale(state)).toBeNull();
    });
  });

  describe('Fallback Selectors', () => {
    describe('getLocaleFallback', () => {
      it('should return fallback info', () => {
        const fallback = {
          requestedLocale: 'de-DE',
          fallbackLocale: 'en-US',
          timestamp: 123456,
        };
        const state = {
          intl: {
            locale: 'en-US',
            localeLoading: null,
            localeFallback: fallback,
            availableLocales: {},
          },
        };
        expect(getLocaleFallback(state)).toEqual(fallback);
      });

      it('should return null when no fallback', () => {
        const state = {
          intl: {
            locale: 'en-US',
            localeLoading: null,
            localeFallback: null,
            availableLocales: {},
          },
        };
        expect(getLocaleFallback(state)).toBeNull();
      });
    });

    describe('hasLocaleFallback', () => {
      it('should return true when fallback exists', () => {
        const state = {
          intl: {
            locale: 'en-US',
            localeLoading: null,
            localeFallback: {
              requestedLocale: 'de-DE',
              fallbackLocale: 'en-US',
            },
            availableLocales: {},
          },
        };
        expect(hasLocaleFallback(state)).toBe(true);
      });

      it('should return false when no fallback', () => {
        const state = {
          intl: {
            locale: 'en-US',
            localeLoading: null,
            localeFallback: null,
            availableLocales: {},
          },
        };
        expect(hasLocaleFallback(state)).toBe(false);
      });
    });
  });

  describe('Available Locales Selectors', () => {
    const createState = availableLocales => ({
      intl: {
        locale: 'en-US',
        localeLoading: null,
        localeFallback: null,
        availableLocales,
      },
    });

    describe('getAvailableLocales', () => {
      it('should return available locales map', () => {
        const locales = { 'en-US': 'English', 'fr-FR': 'French' };
        const state = createState(locales);
        const result = getAvailableLocales(state);
        // Should contain at least the locales we set
        expect(result['en-US']).toBe('English');
        expect(result['fr-FR']).toBe('French');
      });
    });

    describe('getAvailableLocaleCodes', () => {
      it('should return array of locale codes', () => {
        const locales = { 'en-US': 'English', 'fr-FR': 'French' };
        const state = createState(locales);
        const codes = getAvailableLocaleCodes(state);
        // Should contain at least the specified locales
        expect(codes).toContain('en-US');
        expect(codes).toContain('fr-FR');
      });

      it('should return array with default locales when empty', () => {
        const state = createState({});
        const codes = getAvailableLocaleCodes(state);
        // Should contain default locales from normalizeState
        expect(Array.isArray(codes)).toBe(true);
        expect(codes.length).toBeGreaterThan(0);
      });
    });

    describe('isLocaleAvailable', () => {
      it('should return true for available locale', () => {
        const locales = { 'en-US': 'English', 'fr-FR': 'French' };
        const state = createState(locales);
        expect(isLocaleAvailable(state, 'fr-FR')).toBe(true);
      });

      it('should return false for unavailable locale', () => {
        const locales = { 'en-US': 'English' };
        const state = createState(locales);
        expect(isLocaleAvailable(state, 'de-DE')).toBe(false);
      });
    });

    describe('getLocaleDisplayName', () => {
      it('should return display name for locale', () => {
        const locales = { 'en-US': 'English', 'fr-FR': 'French' };
        const state = createState(locales);
        expect(getLocaleDisplayName(state, 'fr-FR')).toBe('French');
      });

      it('should return null for unknown locale', () => {
        const locales = { 'en-US': 'English' };
        const state = createState(locales);
        expect(getLocaleDisplayName(state, 'de-DE')).toBeNull();
      });
    });

    describe('getCurrentLocaleDisplayName', () => {
      it('should return display name for current locale', () => {
        const state = {
          intl: {
            locale: 'fr-FR',
            localeLoading: null,
            localeFallback: null,
            availableLocales: { 'en-US': 'English', 'fr-FR': 'French' },
          },
        };
        expect(getCurrentLocaleDisplayName(state)).toBe('French');
      });

      it('should return null if current locale not in available locales', () => {
        const state = {
          intl: {
            locale: 'de-DE',
            localeLoading: null,
            localeFallback: null,
            availableLocales: { 'en-US': 'English', 'fr-FR': 'French' },
          },
        };
        expect(getCurrentLocaleDisplayName(state)).toBeNull();
      });
    });
  });
});
