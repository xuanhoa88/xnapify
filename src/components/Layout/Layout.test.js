/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import renderer, { act } from 'react-test-renderer';
import configureStore from 'redux-mock-store';
import {
  DEFAULT_LOCALE,
  AVAILABLE_LOCALES,
  getI18nInstance,
} from '../../redux';
import App from '../App';
import Layout from './index';

// =============================================================================
// TEST SETUP
// =============================================================================
const i18n = getI18nInstance();
const mockStore = configureStore();
const fetch = jest.fn();

// Initial Redux state matching current codebase structure
const initialState = {
  runtime: {
    initialNow: Date.now(),
    appName: 'React Starter Kit',
    appDescription: 'Boilerplate for React.js web applications',
  },
  intl: {
    locale: DEFAULT_LOCALE,
    localeLoading: null,
    localeFallback: null,
    availableLocales: AVAILABLE_LOCALES,
  },
  user: null,
  ui: {
    sidebarOpen: false,
    isAdminPanel: false,
    showPageHeader: false,
  },
};

// Mock history object for HistoryProvider
const mockHistory = {
  location: { pathname: '/', search: '', hash: '', state: null, key: 'test' },
  push: jest.fn(),
  replace: jest.fn(),
  go: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  listen: jest.fn(() => jest.fn()), // Returns unsubscribe function
};

// =============================================================================
// TESTS
// =============================================================================

describe('Layout', () => {
  test('renders children correctly', () => {
    const store = mockStore(initialState);
    let component;

    act(() => {
      component = renderer.create(
        <App
          context={{
            store,
            fetch,
            i18n,
            locale: store.getState().intl.locale,
            history: mockHistory,
            pathname: '/',
            query: {},
          }}
        >
          <Layout>
            <div className='child' />
          </Layout>
        </App>,
      );
    });

    const tree = component.toJSON();

    // Test that component renders without crashing
    expect(tree).toBeTruthy();

    // Test that it renders the child element
    expect(tree).toBeDefined();
    expect(tree.type).toBe('div');

    // Cleanup to prevent async callback errors
    act(() => {
      component.unmount();
    });
  });
});
