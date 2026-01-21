/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useSelector } from 'react-redux';
import { isAuthenticated } from '../../../../../../../shared/renderer/redux';
import GuestMode from './GuestMode';
import ProfileDropdown from './ProfileDropdown';

/**
 * Auth Switcher Component
 */
function AuthSwitcher() {
  const isAuth = useSelector(isAuthenticated);

  return isAuth ? <ProfileDropdown /> : <GuestMode />;
}

export default AuthSwitcher;
