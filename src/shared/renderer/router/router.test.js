import { Router } from './index';
import { ROUTE_PATH_DEFAULT } from './constants';

const mockModuleLoader = {
  files: () => [
    './(default)/views/(default)/_route.js',
    './(default)/views/test-nextjs/_route.js',
  ],
  load: path => {
    if (path.includes('test-nextjs')) {
      return {
        default: () => 'TestPage',
        getInitialProps: () => ({ title: 'Test' }),
      };
    }
    return {
      default: () => 'HomePage',
      getInitialProps: () => ({ title: 'Home' }),
    };
  },
};

describe('Router Stress Test', () => {
  it('should resolve /test-nextjs correctly', async () => {
    const router = new Router(mockModuleLoader);

    // Check routes construction
    // Check routes construction
    const rootRoute = router.routes.find(r => r.path === '/');
    expect(rootRoute).toBeDefined();

    const testRoute = rootRoute.children.find(r => r.path === '/test-nextjs');
    expect(testRoute).toBeDefined();
    expect(testRoute.parent).toBeDefined();
    expect(testRoute.parent.path).toBe('/');

    // Check resolution
    const context = {
      pathname: '/test-nextjs',
      store: { getState: () => ({}) },
    };
    const result = await router.resolve(context);

    expect(result).toBeDefined();
    expect(result.component).toBeDefined();
    expect(result.title).toBe('Test');
  });
});
