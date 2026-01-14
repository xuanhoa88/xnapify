/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import reducer, {
  normalizeState,
  setLocaleStart,
  setLocaleSuccess,
  setLocaleError,
  setLocaleFallback,
  clearLocaleFallback,
  updateAvailableLocales,
  resetIntlState,
} from './slice';

describe('[intl] slice.js', () => {
  describe('normalizeState', () => {
    it('should handle null state', () => {
      const result = normalizeState(null);
      expect(result).toEqual({
        locale: 'en-US',
        localeLoading: null,
        localeFallback: null,
        availableLocales: expect.any(Object),
      });
    });

    it('should handle undefined state', () => {
      const result = normalizeState(undefined);
      expect(result.locale).toBe('en-US');
      expect(result.availableLocales).toBeDefined();
    });

    it('should clone and merge state', () => {
      const state = {
        locale: 'fr-FR',
        localeLoading: null,
        localeFallback: null,
        availableLocales: { 'en-US': 'English', 'fr-FR': 'French' },
      };
      const result = normalizeState(state);
      expect(result.locale).toBe('fr-FR');
      expect(result).not.toBe(state);
    });

    it('should deep clone availableLocales', () => {
      const state = {
        locale: 'en-US',
        availableLocales: { 'en-US': 'English' },
      };
      const result = normalizeState(state);
      expect(result.availableLocales).not.toBe(state.availableLocales);
    });
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = reducer(undefined, { type: '@@INIT' });
      expect(state).toEqual({
        locale: 'en-US',
        localeLoading: null,
        localeFallback: null,
        availableLocales: expect.any(Object),
      });
    });
  });

  describe('Locale Change Flow', () => {
    it('should set loading state on locale start', () => {
      const state = reducer(undefined, setLocaleStart({ locale: 'fr-FR' }));
      expect(state.localeLoading).toBe('fr-FR');
      expect(state.locale).toBe('en-US'); // Not changed yet
    });

    it('should update locale on success', () => {
      let state = reducer(undefined, setLocaleStart({ locale: 'fr-FR' }));
      state = reducer(state, setLocaleSuccess({ locale: 'fr-FR' }));
      expect(state.locale).toBe('fr-FR');
      expect(state.localeLoading).toBeNull();
    });

    it('should clear loading on error', () => {
      let state = reducer(undefined, setLocaleStart({ locale: 'fr-FR' }));
      state = reducer(state, setLocaleError());
      expect(state.localeLoading).toBeNull();
      expect(state.locale).toBe('en-US'); // Not changed
    });
  });

  describe('Locale Fallback', () => {
    it('should set locale fallback info', () => {
      const state = reducer(
        undefined,
        setLocaleFallback({
          requestedLocale: 'de-DE',
          fallbackLocale: 'en-US',
        }),
      );
      expect(state.localeFallback).toEqual({
        requestedLocale: 'de-DE',
        fallbackLocale: 'en-US',
        timestamp: expect.any(Number),
      });
    });

    it('should clear locale fallback', () => {
      let state = reducer(
        undefined,
        setLocaleFallback({
          requestedLocale: 'de-DE',
          fallbackLocale: 'en-US',
        }),
      );
      state = reducer(state, clearLocaleFallback());
      expect(state.localeFallback).toBeNull();
    });
  });

  describe('updateAvailableLocales', () => {
    it('should update available locales', () => {
      const newLocales = {
        'en-US': 'English',
        'fr-FR': 'French',
        'es-ES': 'Spanish',
      };
      const state = reducer(undefined, updateAvailableLocales(newLocales));
      expect(state.availableLocales).toEqual(newLocales);
    });

    it('should replace all available locales', () => {
      let state = reducer(
        undefined,
        updateAvailableLocales({ 'en-US': 'English' }),
      );
      state = reducer(state, updateAvailableLocales({ 'fr-FR': 'French' }));
      expect(state.availableLocales).toEqual({ 'fr-FR': 'French' });
    });
  });

  describe('resetIntlState', () => {
    it('should reset to initial state', () => {
      let state = reducer(undefined, setLocaleSuccess({ locale: 'fr-FR' }));
      state = reducer(
        state,
        setLocaleFallback({
          requestedLocale: 'de-DE',
          fallbackLocale: 'en-US',
        }),
      );
      state = reducer(state, resetIntlState());
      expect(state.locale).toBe('en-US');
      expect(state.localeFallback).toBeNull();
      expect(state.localeLoading).toBeNull();
    });
  });

  describe('State Immutability', () => {
    it('should not mutate original state', () => {
      const initialState = reducer(undefined, { type: '@@INIT' });
      const originalState = { ...initialState };
      reducer(initialState, setLocaleSuccess({ locale: 'fr-FR' }));
      expect(initialState).toEqual(originalState);
    });
  });
});
