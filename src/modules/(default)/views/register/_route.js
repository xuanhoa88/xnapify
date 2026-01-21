/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { isAuthenticated } from '../../../../shared/renderer/redux';
import Register from './Register';

/**
 * Page metadata
 */
export const metadata = {
  title: 'Register',
};

/**
 * Guard function - redirect authenticated users
 */
export async function guard(context) {
  const state = context.store.getState();

  if (isAuthenticated(state)) {
    return { redirect: '/' };
  }
}

/**
 * Default export - Page component
 */
export default Register;
