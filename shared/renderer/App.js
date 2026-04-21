/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import './global.css';

import React, { useMemo } from 'react';

import { Theme } from '@radix-ui/themes';
import PropTypes from 'prop-types';
import { I18nextProvider } from 'react-i18next';
import { Provider as ReduxProvider } from 'react-redux';

import { ExtensionProvider } from './Providers/Extension';
import { HistoryProvider } from './Providers/History';

// =============================================================================
// PROP TYPES
// =============================================================================

/**
 * Shape of the context object passed to App
 */
const contextPropTypes = PropTypes.shape({
  /** Dependency Injection container */
  container: PropTypes.object.isRequired,
  /** Universal HTTP client for making API requests */
  fetch: PropTypes.func.isRequired,
  /** Redux store instance */
  store: PropTypes.object.isRequired,
  /** History instance for client-side routing */
  history: PropTypes.object.isRequired,
  /** i18next instance for internationalization */
  i18n: PropTypes.object.isRequired,
  /** Current locale (e.g., 'en', 'fr') */
  locale: PropTypes.string.isRequired,
  /** Current pathname */
  pathname: PropTypes.string.isRequired,
  /** Query parameters object */
  query: PropTypes.object,
}).isRequired;

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Root application component that composes all providers
 *
 * @param {Object} props
 * @param {Object} props.context - Application context containing store, i18n, history, etc.
 * @param {React.ReactNode} props.children - Application content to render
 * @returns {React.ReactElement} Composed provider tree
 */
export default function App({ context, children }) {
  // Memoize the provider composition to prevent unnecessary re-renders
  const providers = useMemo(() => {
    const { registry } = context.container.has('extension')
      ? context.container.resolve('extension')
      : {};

    return (
      <Theme>
        <ReduxProvider store={context.store}>
          <I18nextProvider i18n={context.i18n}>
            <HistoryProvider history={context.history}>
              <ExtensionProvider registry={registry}>
                {React.Children.only(children)}
              </ExtensionProvider>
            </HistoryProvider>
          </I18nextProvider>
        </ReduxProvider>
      </Theme>
    );
  }, [context, children]);

  return providers;
}

// =============================================================================
// PROP VALIDATION
// =============================================================================

App.propTypes = {
  context: contextPropTypes,
  children: PropTypes.node.isRequired,
};
