/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  Component,
  useState,
  useEffect,
  useCallback,
  memo,
  useContext,
} from 'react';

import PropTypes from 'prop-types';

import { AppContext } from '@shared/renderer/AppContext';

import { registry } from './Registry';

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
 * Slot content is rendered only on the client (after mount) to avoid
 * hydration mismatches.  Server-side, extensions are loaded synchronously
 * and would populate the slot, but the client loads extensions
 * asynchronously via Module Federation. React cannot reconcile the
 * structural difference, so we skip server rendering of slot children
 * and let the client fill them in once extensions are ready.
 *
 * Each extension component is wrapped in a SlotErrorBoundary so that
 * a crashing extension renders nothing instead of taking down the page.
 *
 * Usage:
 *   <ExtensionSlot name="profile.fields" formData={formData} />
 */
const ExtensionSlot = memo(function ExtensionSlot({ name, ...props }) {
  // Start as not-mounted; flips to true after hydration completes.
  const [mounted, setMounted] = useState(false);
  const [components, setComponents] = useState([]);
  const context = useContext(AppContext);

  useEffect(() => {
    // Mark as mounted — this only runs on the client after hydration.
    setMounted(true);
  }, []);

  const syncComponents = useCallback(() => {
    setComponents(registry.getSlotEntries(name));
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
        components.map(({ component: Comp, ...options }, index) => {
          const key =
            options.id ||
            options.key ||
            Comp.displayName ||
            Comp.name ||
            `${name}-${index}`;

          return (
            <SlotErrorBoundary key={key}>
              <Comp {...props} context={context} />
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
