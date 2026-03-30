/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Activity Redux Entry Point
 */

import * as selectors from './selector';
import reducer, { SLICE_NAME } from './slice';
import * as thunks from './thunks';

export { SLICE_NAME, selectors, thunks };
export default reducer;
