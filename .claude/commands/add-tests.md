Add tests using Jest and React Test Renderer.

## Run Tests

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

## Component Testing with App Context

Components that use Redux, i18n, or History need the full `App` context:

```javascript
// src/components/MyComponent/MyComponent.test.js
import renderer, { act } from 'react-test-renderer';
import configureStore from 'redux-mock-store';
import i18n, { DEFAULT_LOCALE, AVAILABLE_LOCALES } from '@/shared/i18n';
import App from '@/shared/renderer/App';
import MyComponent from './index';

// =============================================================================
// TEST SETUP
// =============================================================================
const mockStore = configureStore();
const fetch = jest.fn();

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

const mockHistory = {
  location: { pathname: '/', search: '', hash: '', state: null, key: 'test' },
  push: jest.fn(),
  replace: jest.fn(),
  go: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  listen: jest.fn(() => jest.fn()),
};

// =============================================================================
// TESTS
// =============================================================================

describe('MyComponent', () => {
  test('renders correctly', () => {
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
          <MyComponent />
        </App>,
      );
    });

    const tree = component.toJSON();
    expect(tree).toBeTruthy();

    // Cleanup
    act(() => {
      component.unmount();
    });
  });
});
```

## Simple Component Testing

For components without context dependencies:

```javascript
import renderer from 'react-test-renderer';
import Button from './Button';

describe('Button', () => {
  test('renders with text', () => {
    const tree = renderer.create(<Button>Click me</Button>).toJSON();
    expect(tree.children).toContain('Click me');
  });

  test('handles click', () => {
    const onClick = jest.fn();
    const component = renderer.create(<Button onClick={onClick}>Click</Button>);

    component.root.findByType('button').props.onClick();
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
```

## Mocking

```javascript
// Mock module
jest.mock('@/shared/renderer/redux/features/user/selector', () => ({
  ...jest.requireActual('@/shared/renderer/redux/features/user/selector'),
  isAuthenticated: jest.fn(() => true),
}));

// Mock function
const mockFn = jest.fn(() => Promise.resolve({ data: [] }));
```

## Best Practices

1. Use `act()` for state updates
2. Unmount components to prevent async errors
3. Mock `history`, `store`, `fetch`, and `i18n` for App context
4. Use `mockStore` with `initialState` matching Redux structure
5. Test behavior, not implementation
