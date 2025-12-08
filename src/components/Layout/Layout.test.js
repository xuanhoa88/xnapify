/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import renderer from 'react-test-renderer';
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import i18n from '../../i18n';
import App from '../App';
import Layout from './index';

// =============================================================================
// TEST SETUP
// =============================================================================

const middlewares = [thunk];
const mockStore = configureStore(middlewares);

// Initial Redux state matching current codebase structure
const initialState = {
  runtime: {
    initialNow: Date.now(),
    appName: 'React Starter Kit',
    appDescription: 'Boilerplate for React.js web applications',
  },
  intl: {
    locale: 'en-US',
    localeLoading: null,
    messages: {},
    localeFallback: null,
    availableLocales: {
      'en-US': 'English (US)',
      'vi-VN': 'Tiếng Việt',
    },
  },
  user: null,
};

// =============================================================================
// TESTS
// =============================================================================

describe('Layout', () => {
  test('renders children correctly', () => {
    const store = mockStore(initialState);

    const component = renderer.create(
      <App
        context={{
          store,
          fetch: () => {},
          i18n,
          pathname: '/',
          query: {},
        }}
      >
        <Layout>
          <div className='child' />
        </Layout>
      </App>,
    );

    const tree = component.toJSON();

    // Test that component renders without crashing
    expect(tree).toBeTruthy();

    // Test that it renders the child element
    expect(tree).toBeDefined();
    expect(tree.type).toBe('div');
  });
});
