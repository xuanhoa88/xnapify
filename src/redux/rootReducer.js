/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { combineReducers } from 'redux';
import intl from './features/intl';
import runtime from './features/runtime';
import user from './features/user';
import ui from './features/ui';
import groups from './features/groups';

export default combineReducers({
  intl,
  runtime,
  user,
  ui,
  groups,
});
