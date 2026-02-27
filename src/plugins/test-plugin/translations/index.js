/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { PLUGIN_ID } from '../constants';
import { getTranslations } from '../../../shared/i18n/getTranslations';
import { addNamespace } from '../../../shared/i18n/addNamespace';

// Export a function to register translations using the shared i18n instance
export function registerTranslations(i18n) {
  addNamespace(
    PLUGIN_ID,
    getTranslations(require.context('./', false, /\.json$/i)),
    i18n,
  );
}
