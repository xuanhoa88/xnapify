import { addNamespace } from '@shared/i18n/utils';

import { ROUTE_TRANSLATIONS_KEY } from './constants';
import { buildTranslationsLoader, loadRouteTranslations } from './lifecycle';

jest.mock('@shared/i18n/utils', () => ({
  addNamespace: jest.fn(),
}));

jest.mock('@shared/i18n/loader', () => ({
  getTranslations: jest.fn(val => val), // Pass through map
}));

describe('Translations Inheritance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

      await loadRouteTranslations(grandchildRoute);

      expect(routeTranslationsRoot).toHaveBeenCalledWith({});
      expect(routeTranslationsChild).toHaveBeenCalledWith({ rootProp: true });
      expect(routeTranslationsGrandchild).toHaveBeenCalledWith({
        rootProp: true,
        childProp: true,
      });

      expect(rootRoute[ROUTE_TRANSLATIONS_KEY]).toEqual({ rootProp: true });
      expect(childRoute[ROUTE_TRANSLATIONS_KEY]).toEqual({
        rootProp: true,
        childProp: true,
      });
      expect(grandchildRoute[ROUTE_TRANSLATIONS_KEY]).toEqual({
        rootProp: true,
        childProp: true,
        grandProp: true,
      });
    });

    it('should reuse accumulated translations if already executed', async () => {
      const rootTranslations = jest.fn(() => ({ root: true }));
      const childTranslations = jest.fn(inherited => ({
        ...inherited,
        child: true,
      }));

      const rootRoute = {
        path: '/',
        translations: rootTranslations,
        [ROUTE_TRANSLATIONS_KEY]: { root: true },
      };
      const childRoute = {
        path: '/child',
        parent: rootRoute,
        translations: childTranslations,
      };

      await loadRouteTranslations(childRoute);

      // Should completely skip calling root's translation fn again because ROUTE_TRANSLATIONS_KEY exists
      expect(rootTranslations).not.toHaveBeenCalled();

      // Should call child with the cached root translations
      expect(childTranslations).toHaveBeenCalledWith({ root: true });
    });
  });
});
