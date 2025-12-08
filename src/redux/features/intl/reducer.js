/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  SET_LOCALE_START,
  SET_LOCALE_SUCCESS,
  SET_LOCALE_ERROR,
  SET_LOCALE_FALLBACK,
  SET_AVAILABLE_LOCALES,
} from './constants';
import { AVAILABLE_LOCALES, DEFAULT_LOCALE } from './config';

// Initial state for intl feature
const initialState = {
  locale: DEFAULT_LOCALE,
  localeLoading: null, // Locale currently being loaded (null = no loading in progress)
  messages: {},
  localeFallback: null, // Fallback info when requested locale is not available
  availableLocales: AVAILABLE_LOCALES, // List of available locales
};

export default function intl(state = initialState, action) {
  switch (action.type) {
    case SET_LOCALE_START: {
      // If messages already loaded, switch locale immediately
      // Otherwise, keep current locale and show loading state
      const locale = state.messages[action.payload.locale]
        ? action.payload.locale
        : state.locale;
      return {
        ...state,
        locale,
        localeLoading: action.payload.locale,
      };
    }

    case SET_LOCALE_SUCCESS: {
      return {
        ...state,
        locale: action.payload.locale,
        localeLoading: null,
        messages: {
          ...state.messages,
          [action.payload.locale]: action.payload.messages,
        },
      };
    }

    case SET_LOCALE_ERROR: {
      return {
        ...state,
        localeLoading: null,
      };
    }

    case SET_LOCALE_FALLBACK: {
      return {
        ...state,
        localeFallback: {
          requestedLocale: action.payload.requestedLocale,
          fallbackLocale: action.payload.fallbackLocale,
          timestamp: Date.now(),
        },
      };
    }

    case SET_AVAILABLE_LOCALES: {
      return {
        ...state,
        availableLocales: { ...action.payload },
      };
    }

    default: {
      return state;
    }
  }
}
