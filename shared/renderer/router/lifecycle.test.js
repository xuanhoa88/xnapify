/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

import { addNamespace } from '@shared/i18n/utils.js';

import { ROUTE_TRANSLATIONS_KEY } from './constants.js';
import { buildTranslationsLoader, loadRouteTranslations } from './lifecycle.js';

jest.mock('@shared/i18n/utils', () => ({
  addNamespace: jest.fn(),
}));

jest.mock('@shared/i18n/loader', () => ({
  __esModule: true,
  getTranslations: jest.fn(val => val), // Pass through map
}));

describe('Translations Inheritance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Re-establish mock implementation after clearAllMocks resets it
    const { getTranslations } = require('@shared/i18n/loader.js');
    getTranslations.mockImplementation(val => val);
  });

  describe('buildTranslationsLoader', () => {
    it('should deep merge inherited translations with local configurations', () => {
      const parentTranslations = { 'en-US': { hello: 'world' } };

      const configs = [
        {
          module: {
            translations: () => ({
              'en-US': { button: 'Save' },
            }),
          },
        },
      ];

      const routeTranslations = () => ({
        'en-US': { title: 'Dashboard' },
        'vi-VN': { title: 'Bảng điều khiển' },
      });

      const registerFn = buildTranslationsLoader(
        configs,
        routeTranslations,
        '/admin',
        'adminView',
      );
      const merged = registerFn(parentTranslations);

      expect(merged).toEqual({
        'en-US': { hello: 'world', button: 'Save', title: 'Dashboard' },
        'vi-VN': { title: 'Bảng điều khiển' },
      });

      expect(addNamespace).toHaveBeenCalledWith('adminView', merged);
    });

    it('should NOT mutate the passed inheritedTranslations object', () => {
      const parentTranslations = { 'en-US': { key: 'value' } };

      const routeTranslations = () => ({
        'en-US': { key2: 'value2' },
      });

      const registerFn = buildTranslationsLoader(
        [],
        routeTranslations,
        '/test',
      );
      const merged = registerFn(parentTranslations);

      // Parent is unmodified
      expect(parentTranslations).toEqual({ 'en-US': { key: 'value' } });

      // Merged has both
      expect(merged).toEqual({ 'en-US': { key: 'value', key2: 'value2' } });
    });
  });

  describe('loadRouteTranslations', () => {
    it('should accumulate translations down the route tree (parent to child)', async () => {
      const routeTranslationsRoot = jest.fn(inherited => {
        return { ...inherited, rootProp: true };
      });
      const routeTranslationsChild = jest.fn(inherited => {
        return { ...inherited, childProp: true };
      });
      const routeTranslationsGrandchild = jest.fn(inherited => {
        return { ...inherited, grandProp: true };
      });

      const rootRoute = { path: '/', translations: routeTranslationsRoot };
      const childRoute = {
        path: '/child',
        parent: rootRoute,
        translations: routeTranslationsChild,
      };
      const grandchildRoute = {
        path: '/child/grand',
        parent: childRoute,
        translations: routeTranslationsGrandchild,
      };

      const ctx = { pathname: '/child/grand' };
      await loadRouteTranslations(grandchildRoute, ctx);

      expect(routeTranslationsRoot).toHaveBeenCalledWith({});
      expect(routeTranslationsChild).toHaveBeenCalledWith({ rootProp: true });
      expect(routeTranslationsGrandchild).toHaveBeenCalledWith({
        rootProp: true,
        childProp: true,
      });

      // Memoised on the navigation context, never on the route node.
      const registered = ctx[ROUTE_TRANSLATIONS_KEY];
      expect(registered.get(rootRoute)).toEqual({ rootProp: true });
      expect(registered.get(childRoute)).toEqual({
        rootProp: true,
        childProp: true,
      });
      expect(registered.get(grandchildRoute)).toEqual({
        rootProp: true,
        childProp: true,
        grandProp: true,
      });
      expect(rootRoute[ROUTE_TRANSLATIONS_KEY]).toBeUndefined();
    });

    it('should reuse accumulated translations within the same navigation', async () => {
      const rootTranslations = jest.fn(() => ({ root: true }));
      const childTranslations = jest.fn(inherited => ({
        ...inherited,
        child: true,
      }));

      const rootRoute = { path: '/', translations: rootTranslations };
      const childRoute = {
        path: '/child',
        parent: rootRoute,
        translations: childTranslations,
      };

      // The router calls this once per matched route, so a hierarchy is
      // walked several times within one navigation.
      const ctx = { pathname: '/child' };
      await loadRouteTranslations(rootRoute, ctx);
      await loadRouteTranslations(childRoute, ctx);

      expect(rootTranslations).toHaveBeenCalledTimes(1);
      expect(childTranslations).toHaveBeenCalledWith({ root: true });
    });

    it('re-registers for a second navigation over the same route node', async () => {
      // The server compiles one route tree and shares its nodes across every
      // request. A memo written on the node would register a route's
      // namespace for the first request only and leave every later request
      // resolving raw keys.
      const rootTranslations = jest.fn(() => ({ root: true }));
      const rootRoute = { path: '/', translations: rootTranslations };

      await loadRouteTranslations(rootRoute, { pathname: '/' });
      await loadRouteTranslations(rootRoute, { pathname: '/' });

      expect(rootTranslations).toHaveBeenCalledTimes(2);
    });
  });
});
