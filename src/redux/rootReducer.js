/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { combineReducers } from 'redux';
import user from './features/user';
import runtime from './features/runtime';
import intl from './features/intl';
import ui from './features/ui';
import groups from './features/groups';
import roles from './features/roles';
import permissions from './features/permissions';
import usersManagement from './features/usersManagement';

export default combineReducers({
  user,
  runtime,
  intl,
  ui,
  groups,
  roles,
  permissions,
  usersManagement,
});
