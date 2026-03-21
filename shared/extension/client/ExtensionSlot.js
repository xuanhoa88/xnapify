/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useEffect, useCallback, memo } from 'react';

import PropTypes from 'prop-types';

import { useAppContext } from '@shared/renderer/AppContext';

import { registry } from '../utils/Registry';

/**
 * ExtensionSlot - Renders components registered for a named slot
 *
 * Slot content is rendered only on the client (after mount) to avoid
 * hydration mismatches.  Server-side, extensions are loaded synchronously
 * and would populate the slot, but the client loads extensions
 * asynchronously via Module Federation. React cannot reconcile the
 * structural difference, so we skip server rendering of slot children
 * and let the client fill them in once extensions are ready.
 *
 * Usage:
 *   <ExtensionSlot name="profile.fields" formData={formData} />
 */
const ExtensionSlot = memo(function ExtensionSlot({ name, ...props }) {
  // Start as not-mounted; flips to true after hydration completes.
  const [mounted, setMounted] = useState(false);
  const [components, setComponents] = useState([]);
  const context = useAppContext();

  useEffect(() => {
    // Mark as mounted — this only runs on the client after hydration.
    setMounted(true);
  }, []);

  const syncComponents = useCallback(() => {
    setComponents(registry.getSlot(name));
  }, [name]);

  useEffect(() => {
    if (!mounted) return undefined;

    // Sync immediately in case registry already has entries
    syncComponents();

    // Subscribe to future changes (extensions loading later)
    return registry.subscribe(syncComponents);
  }, [mounted, syncComponents]);

  return (
    <div data-slot={name}>
      {mounted &&
        components.map(({ component: Component, ...options }, index) => {
          const key =
            options.id ||
            options.key ||
            Component.displayName ||
            Component.name ||
            `${name}-${index}`;

          return <Component key={key} {...props} context={context} />;
        })}
    </div>
  );
});

ExtensionSlot.displayName = 'ExtensionSlot';

ExtensionSlot.propTypes = {
  name: PropTypes.string.isRequired,
};

export default ExtensionSlot;
