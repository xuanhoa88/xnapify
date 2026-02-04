/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { registry } from './registry';

/**
 * PluginSlot - Renders components registered for a named slot
 *
 * Usage:
 *   <PluginSlot name="profile.fields" formData={formData} />
 */
function PluginSlot({ name, ...props }) {
  const [components, setComponents] = useState(() => {
    const slots = registry.getSlot(name);
    return slots;
  });

  useEffect(() => {
    // Sync with current registry state
    setComponents(registry.getSlot(name));

    // Subscribe to future changes
    const unsubscribe = registry.subscribe(() => {
      setComponents(registry.getSlot(name));
    });

    return unsubscribe;
  }, [name]);

  if (!components.length) return null;

  return components.map(({ component: Component$, ...options }, index) => {
    const key =
      options.id ||
      options.key ||
      Component$.displayName ||
      Component$.name ||
      `${name}-${index}`;
    return <Component$ key={key} {...props} />;
  });
}

PluginSlot.propTypes = {
  name: PropTypes.string.isRequired,
};

export default PluginSlot;
