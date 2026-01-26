/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  isDrawerOpen,
  getFlashMessage,
  hasFlashMessage,
  getFlashMessageVariant,
  getFlashMessageText,
  getAllBreadcrumbs,
  getBreadcrumbs,
} from './selector';

describe('[ui] selector.js', () => {
  describe('Drawer Selectors', () => {
    describe('isDrawerOpen', () => {
      it('should return true when drawer is open', () => {
        const state = {
          ui: {
            drawers: { admin: true },
            breadcrumbs: {},
            flashMessage: null,
          },
        };
        expect(isDrawerOpen(state, 'admin')).toBe(true);
      });

      it('should return false when drawer is closed', () => {
        const state = {
          ui: {
            drawers: { admin: false },
            breadcrumbs: {},
            flashMessage: null,
          },
        };
        expect(isDrawerOpen(state, 'admin')).toBe(false);
      });

      it('should return false when drawer namespace does not exist', () => {
        const state = {
          ui: {
            drawers: {},
            breadcrumbs: {},
            flashMessage: null,
          },
        };
        expect(isDrawerOpen(state, 'admin')).toBe(false);
      });

      it('should use default namespace when not specified', () => {
        const state = {
          ui: {
            drawers: { default: true },
            breadcrumbs: {},
            flashMessage: null,
          },
        };
        expect(isDrawerOpen(state)).toBe(true);
      });
    });
  });

  describe('Flash Message Selectors', () => {
    describe('getFlashMessage', () => {
      it('should return flash message', () => {
        const message = { variant: 'success', message: 'Success!' };
        const state = {
          ui: {
            drawers: {},
            breadcrumbs: {},
            flashMessage: message,
          },
        };
        expect(getFlashMessage(state)).toEqual(message);
      });

      it('should return null when no flash message', () => {
        const state = {
          ui: {
            drawers: {},
            breadcrumbs: {},
            flashMessage: null,
          },
        };
        expect(getFlashMessage(state)).toBeNull();
      });
    });

    describe('hasFlashMessage', () => {
      it('should return true when flash message exists', () => {
        const state = {
          ui: {
            drawers: {},
            breadcrumbs: {},
            flashMessage: { variant: 'info', message: 'Info' },
          },
        };
        expect(hasFlashMessage(state)).toBe(true);
      });

      it('should return false when no flash message', () => {
        const state = {
          ui: {
            drawers: {},
            breadcrumbs: {},
            flashMessage: null,
          },
        };
        expect(hasFlashMessage(state)).toBe(false);
      });
    });

    describe('getFlashMessageVariant', () => {
      it('should return flash message variant', () => {
        const state = {
          ui: {
            drawers: {},
            breadcrumbs: {},
            flashMessage: { variant: 'error', message: 'Error!' },
          },
        };
        expect(getFlashMessageVariant(state)).toBe('error');
      });

      it('should return null when no flash message', () => {
        const state = {
          ui: {
            drawers: {},
            breadcrumbs: {},
            flashMessage: null,
          },
        };
        expect(getFlashMessageVariant(state)).toBeNull();
      });
    });

    describe('getFlashMessageText', () => {
      it('should return flash message text', () => {
        const state = {
          ui: {
            drawers: {},
            breadcrumbs: {},
            flashMessage: { variant: 'warning', message: 'Warning!' },
          },
        };
        expect(getFlashMessageText(state)).toBe('Warning!');
      });

      it('should return null when no flash message', () => {
        const state = {
          ui: {
            drawers: {},
            breadcrumbs: {},
            flashMessage: null,
          },
        };
        expect(getFlashMessageText(state)).toBeNull();
      });
    });
  });

  describe('Breadcrumb Selectors', () => {
    describe('getAllBreadcrumbs', () => {
      it('should return all breadcrumbs', () => {
        const breadcrumbs = {
          admin: [{ label: 'Admin' }],
          user: [{ label: 'User' }],
        };
        const state = {
          ui: {
            drawers: {},
            breadcrumbs,
            flashMessage: null,
          },
        };
        expect(getAllBreadcrumbs(state)).toEqual(breadcrumbs);
      });

      it('should return empty object when no breadcrumbs', () => {
        const state = {
          ui: {
            drawers: {},
            breadcrumbs: {},
            flashMessage: null,
          },
        };
        expect(getAllBreadcrumbs(state)).toEqual({});
      });
    });

    describe('getBreadcrumbs', () => {
      it('should return admin breadcrumbs', () => {
        const adminBreadcrumbs = [{ label: 'Admin' }, { label: 'Users' }];
        const state = {
          ui: {
            drawers: {},
            breadcrumbs: {
              admin: adminBreadcrumbs,
              user: [{ label: 'User' }],
            },
            flashMessage: null,
          },
        };
        expect(getBreadcrumbs(state)).toEqual(adminBreadcrumbs);
      });

      it('should return empty array when admin breadcrumbs do not exist', () => {
        const state = {
          ui: {
            drawers: {},
            breadcrumbs: {
              user: [{ label: 'User' }],
            },
            flashMessage: null,
          },
        };
        expect(getBreadcrumbs(state)).toEqual([]);
      });
    });
  });

  describe('Handle Legacy State', () => {
    it('should normalize legacy breadcrumb format', () => {
      const state = {
        ui: {
          breadcrumbs: [{ label: 'Home' }, { label: 'Page' }],
        },
      };
      const allBreadcrumbs = getAllBreadcrumbs(state);
      expect(allBreadcrumbs.default).toEqual([
        { label: 'Home' },
        { label: 'Page' },
      ]);
    });
  });
});
