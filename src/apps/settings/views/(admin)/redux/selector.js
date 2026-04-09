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
