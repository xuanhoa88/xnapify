/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { Component, useState, useEffect, useCallback, memo } from 'react';

import PropTypes from 'prop-types';

import { useExtensionRegistry } from './useExtension';

/**
 * Error boundary that catches render errors from extension components.
 * Prevents a single broken extension from crashing the entire page.
 */
class SlotErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error(
      `[ExtensionSlot] Extension component crashed:`,
      error,
      info.componentStack,
    );
  }

  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

SlotErrorBoundary.propTypes = {
  children: PropTypes.node,
};

SlotErrorBoundary.defaultProps = {
  children: null,
};

/**
 * ExtensionSlot - Renders components registered for a named slot
 *
 * Slot content is rendered synchronously. During SSR, it consumes the server registry
 * via Context, ensuring the server HTML matches the client's hydrated state perfectly
 * and eliminating any visual delay or pop-in effect.
 *
 * Each extension component is wrapped in a SlotErrorBoundary so that
 * a crashing extension renders nothing instead of taking down the page.
 *
 * Usage:
 *   <ExtensionSlot name="profile.fields" formData={formData} />
 */
const ExtensionSlot = memo(function ExtensionSlot({ name, ...props }) {
  const registry = useExtensionRegistry();
  const [components, setComponents] = useState(() =>
    registry ? registry.getSlotEntries(name) : [],
  );

  const syncComponents = useCallback(() => {
    if (!registry) return;
    setComponents(registry.getSlotEntries(name));
  }, [registry, name]);

  useEffect(() => {
    if (!registry) return undefined;

    // Sync immediately in case registry already has entries
    syncComponents();

    // Subscribe to future changes (extensions loading later)
    return registry.subscribe(syncComponents);
  }, [registry, syncComponents]);

  return (
    <div data-slot={name}>
      {components.map(({ component: Comp, ...options }, index) => {
        const key =
          options.id ||
          options.key ||
          Comp.displayName ||
          Comp.name ||
          `${name}-${index}`;

        return (
          <SlotErrorBoundary key={key}>
            <Comp {...props} />
          </SlotErrorBoundary>
        );
      })}
    </div>
  );
});

ExtensionSlot.displayName = 'ExtensionSlot';

ExtensionSlot.propTypes = {
  name: PropTypes.string.isRequired,
};

export default ExtensionSlot;
