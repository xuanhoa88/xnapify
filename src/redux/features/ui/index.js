/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// Public API - Selectors
export {
  isAdminDrawerOpen,
  getFlashMessage,
  hasFlashMessage,
  getFlashMessageVariant,
  getFlashMessageText,
} from './selector';

// Public API - Actions (from slice)
export {
  toggleAdminDrawer,
  setAdminDrawerOpen,
  setFlashMessage,
  clearFlashMessage,
  showSuccessMessage,
  showErrorMessage,
  showWarningMessage,
  showInfoMessage,
  resetUiState,
} from './slice';

// Public API - Reducer
export { default } from './slice';
