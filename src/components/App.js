/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import PropTypes from 'prop-types';
import React from 'react';
import { I18nextProvider } from 'react-i18next';
import { Provider as ReduxProvider } from 'react-redux';
import { HistoryProvider } from '../components/History';

export default function App({ context, children }) {
  return (
    <ReduxProvider store={context.store}>
      <I18nextProvider i18n={context.i18n}>
        <HistoryProvider history={context.history}>
          {React.Children.only(children)}
        </HistoryProvider>
      </I18nextProvider>
    </ReduxProvider>
  );
}

const ContextTypes = {
  // Universal HTTP client
  fetch: PropTypes.func.isRequired,
  // Redux store
  store: PropTypes.object.isRequired,
  // History instance
  history: PropTypes.object.isRequired,
  // I18next instance
  i18n: PropTypes.object.isRequired,
  // Current locale
  locale: PropTypes.string.isRequired,
  // Current pathname
  pathname: PropTypes.string.isRequired,
  // Query parameters
  query: PropTypes.object,
};

App.propTypes = {
  context: PropTypes.shape(ContextTypes).isRequired,
  children: PropTypes.node.isRequired,
};
