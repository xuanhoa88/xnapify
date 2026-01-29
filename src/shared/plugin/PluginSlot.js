/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import PropTypes from 'prop-types';
import registry from './registry';

/**
 * PluginSlot - Renders components registered for a named slot
 *
 * Usage:
 *   <PluginSlot name="profile.fields" formData={formData} />
 */
function PluginSlot({ name, ...props }) {
  const components = registry.getSlot(name);

  if (!components.length) return null;

  return components.map(({ component: Component$ }, index) => (
    <Component$ key={`${name}-${index}`} {...props} />
  ));
}

PluginSlot.propTypes = {
  name: PropTypes.string.isRequired,
};

export default PluginSlot;
