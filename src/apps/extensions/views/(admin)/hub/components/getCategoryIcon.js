/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

const ICON_MAP = {
  utility: 'settings',
  integration: 'linkedin',
  cms: 'edit',
  payment: 'file-text',
  social: 'users',
  security: 'shield',
  analytics: 'activity',
  storage: 'database',
  auth: 'lock',
  authentication: 'lock',
  communication: 'mail',
  productivity: 'check-circle',
  'developer tools': 'settings',
};

export default function getCategoryIcon(category) {
  return ICON_MAP[category ? category.toLowerCase() : ''] || 'extension';
}
