// Benchmarks for renderer-related utilities such as store configuration and
// simple server-side rendering. These help ensure the bootstrap cost of the
// client/server entrypoints stays reasonable.

const React = require('react');
const ReactDOMServer = require('react-dom/server');
const { performance } = require('perf_hooks');

const configureStore = require('@shared/renderer/redux/configureStore').default;
const App = require('@shared/renderer/App').default;

// simple dummy context that mimics what the real application provides
function createDummyContext() {
  const store = configureStore();
  return {
    container: {},
    fetch: () => Promise.resolve(),
    store,
    history: { listen: () => {} },
    i18n: {
      // minimal subset of i18next API used by App
      language: 'en',
      changeLanguage: () => Promise.resolve(),
      t: key => key,
    },
    locale: 'en',
    pathname: '/',
    query: {},
  };
}

// create a moderately deep component tree for SSR
function makeTree(levels, breadth) {
  if (levels === 0) return React.createElement('span', null, 'leaf');
  const children = [];
  for (let i = 0; i < breadth; i++) {
    children.push(makeTree(levels - 1, breadth));
  }
  return React.createElement('div', null, children);
}

describe('renderer performance', () => {
  it('configures Redux store 100 times quickly', () => {
    const runs = 100;
    const start = performance.now();
    for (let i = 0; i < runs; i++) {
      configureStore();
    }
    const duration = performance.now() - start;
    console.log(`${runs} store configurations took ${duration.toFixed(2)}ms`);
    expect(duration).toBeLessThan(200); // ~2ms per create
  });

  it('SSR renders a moderately-sized tree quickly', () => {
    const tree = makeTree(4, 3); // about 3^4 = 81 leaves
    const ctx = createDummyContext();
    const element = React.createElement(App, { context: ctx }, tree);

    const start = performance.now();
    const html = ReactDOMServer.renderToString(element);
    const duration = performance.now() - start;

    console.log(
      `rendered tree length ${html.length} in ${duration.toFixed(2)}ms`,
    );
    expect(html).toContain('leaf');
    expect(duration).toBeLessThan(300);
  });
});
