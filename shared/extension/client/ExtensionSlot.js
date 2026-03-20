/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useEffect, useCallback, Fragment, memo } from 'react';

import PropTypes from 'prop-types';

import { useAppContext } from '@shared/renderer/AppContext';

import { registry } from '../utils/Registry';

/**
 * ExtensionSlot - Renders components registered for a named slot
 *
 * Usage:
 *   <ExtensionSlot name="profile.fields" formData={formData} />
 */
const ExtensionSlot = memo(function ExtensionSlot({ name, ...props }) {
  const [components, setComponents] = useState(() => registry.getSlot(name));
  const context = useAppContext();

  const syncComponents = useCallback(() => {
    setComponents(registry.getSlot(name));
  }, [name]);

  useEffect(() => {
    // Sync immediately in case registry changed between render and effect
    syncComponents();

    // Subscribe to future changes
    return registry.subscribe(syncComponents);
  }, [syncComponents]);

  if (!components.length) return null;

  return (
    <Fragment>
      {components.map(({ component: Component, ...options }, index) => {
        const key =
          options.id ||
          options.key ||
          Component.displayName ||
          Component.name ||
          `${name}-${index}`;

        return <Component key={key} {...props} context={context} />;
      })}
    </Fragment>
  );
});

ExtensionSlot.displayName = 'ExtensionSlot';

ExtensionSlot.propTypes = {
  name: PropTypes.string.isRequired,
};

export default ExtensionSlot;
