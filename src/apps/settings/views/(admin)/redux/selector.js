/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { SLICE_NAME } from './slice';

/**
 * Select the full settings slice state.
 */
export const selectSettingsState = state => state[SLICE_NAME] || {};

/**
 * Select grouped settings.
 */
export const selectGroups = state => selectSettingsState(state).groups || {};

/**
 * Select loading state.
 */
export const selectLoading = state => !!selectSettingsState(state).loading;

/**
 * Select saving state.
 */
export const selectSaving = state => !!selectSettingsState(state).saving;

/**
 * Select error.
 */
export const selectError = state => selectSettingsState(state).error || null;

/**
 * Select initialized state.
 */
export const selectInitialized = state =>
  !!selectSettingsState(state).initialized;
