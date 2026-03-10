/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

const createOperationState = () => ({ loading: false, error: null });

/**
 * Create a fresh operations object with all operation states.
 * This ensures we never return a reference to a frozen initialState.operations.
 */
const createFreshOperations = () => ({
  auth: createOperationState(),
  emailVerification: createOperationState(),
  resetPassword: createOperationState(),
  profile: createOperationState(),
  avatar: createOperationState(),
  password: createOperationState(),
  delete: createOperationState(),
  preferences: createOperationState(),
});

// Initial state with fresh operations
export const initialState = {
  data: null,
  operations: createFreshOperations(),
};

/**
 * Normalize state to ensure it has the expected shape.
 * This handles migration from old state format (plain user object or null)
 * to new format ({ data, operations }).
 * Always clones operations to avoid SSR frozen state issues.
 * Exported for reuse in selectors.
 *
 * @param {Object|null|undefined} state - User state to normalize
 * @returns {Object} Normalized state with expected shape
 */
export const normalizeState = state => {
  // Handle null/undefined/non-object
  if (!state || typeof state !== 'object') {
    return { data: null, operations: createFreshOperations() };
  }

  // State already has proper structure - clone operations to ensure mutability
  if ('operations' in state) {
    return {
      data: state.data,
      operations: { ...createFreshOperations(), ...state.operations },
    };
  }

  // Legacy state with 'data' key (SSR) or with 'loading' at root
  if ('data' in state || 'loading' in state) {
    return { data: state.data || null, operations: createFreshOperations() };
  }

  // Very old format: state is user data directly
  return { data: state, operations: createFreshOperations() };
};

export { createOperationState, createFreshOperations };
