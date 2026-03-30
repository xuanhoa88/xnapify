/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  getAppName,
  getAppDescription,
  getInitialNow,
  getRuntimeVariable,
} from './selector';

describe('[runtime] selector.js', () => {
  describe('getAppName', () => {
    it('should return app name from state', () => {
      const state = {
        runtime: {
          appName: 'My App',
          appDescription: null,
          initialNow: null,
        },
      };
      expect(getAppName(state)).toBe('My App');
    });

    it('should return default value when app name is null', () => {
      const state = {
        runtime: {
          appName: null,
          appDescription: null,
          initialNow: null,
        },
      };
      expect(getAppName(state)).toBe('xnapify');
    });

    it('should return custom default value', () => {
      const state = {
        runtime: {
          appName: null,
          appDescription: null,
          initialNow: null,
        },
      };
      expect(getAppName(state, 'Custom Default')).toBe('Custom Default');
    });

    it('should handle legacy state format', () => {
      const state = {
        runtime: { appName: 'Legacy App' },
      };
      expect(getAppName(state)).toBe('Legacy App');
    });
  });

  describe('getAppDescription', () => {
    it('should return app description from state', () => {
      const state = {
        runtime: {
          appName: null,
          appDescription: 'My app description',
          initialNow: null,
        },
      };
      expect(getAppDescription(state)).toBe('My app description');
    });

    it('should return default value when description is null', () => {
      const state = {
        runtime: {
          appName: null,
          appDescription: null,
          initialNow: null,
        },
      };
      expect(getAppDescription(state)).toBe(
        'Boilerplate for React.js web applications',
      );
    });

    it('should return custom default value', () => {
      const state = {
        runtime: {
          appName: null,
          appDescription: null,
          initialNow: null,
        },
      };
      expect(getAppDescription(state, 'Custom Description')).toBe(
        'Custom Description',
      );
    });
  });

  describe('getInitialNow', () => {
    it('should return initial timestamp from state', () => {
      const state = {
        runtime: {
          appName: null,
          appDescription: null,
          initialNow: 1234567890,
        },
      };
      expect(getInitialNow(state)).toBe(1234567890);
    });

    it('should return null when not set', () => {
      const state = {
        runtime: {
          appName: null,
          appDescription: null,
          initialNow: null,
        },
      };
      expect(getInitialNow(state)).toBeNull();
    });
  });

  describe('getRuntimeVariable', () => {
    it('should return runtime variable by name', () => {
      const state = {
        runtime: {
          appName: 'My App',
          appDescription: 'Description',
          initialNow: 123456,
          customVar: 'custom value',
        },
      };
      expect(getRuntimeVariable(state, 'customVar')).toBe('custom value');
    });

    it('should return default value when variable does not exist', () => {
      const state = {
        runtime: {
          appName: null,
          appDescription: null,
          initialNow: null,
        },
      };
      expect(getRuntimeVariable(state, 'nonExistent', 'default')).toBe(
        'default',
      );
    });

    it('should return known variables', () => {
      const state = {
        runtime: {
          appName: 'My App',
          appDescription: null,
          initialNow: null,
        },
      };
      expect(getRuntimeVariable(state, 'appName')).toBe('My App');
    });

    it('should handle undefined default value', () => {
      const state = {
        runtime: {
          appName: null,
          appDescription: null,
          initialNow: null,
        },
      };
      expect(getRuntimeVariable(state, 'nonExistent')).toBeUndefined();
    });
  });
});
