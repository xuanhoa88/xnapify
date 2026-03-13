/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import reducer, {
  toggleDrawer,
  setFlashMessage,
  clearFlashMessage,
  showSuccessMessage,
  showErrorMessage,
  showWarningMessage,
  showInfoMessage,
  setBreadcrumbs,
  addBreadcrumb,
  clearBreadcrumbs,
  resetUiState,
} from './slice';
import { normalizeState } from './utils';

describe('[ui] slice.js', () => {
  describe('normalizeState', () => {
    it('should handle null state', () => {
      const result = normalizeState(null);
      expect(result).toEqual({
        drawers: {},
        breadcrumbs: {},
        flashMessage: null,
      });
    });

    it('should handle undefined state', () => {
      const result = normalizeState(undefined);
      expect(result.drawers).toEqual({});
      expect(result.breadcrumbs).toEqual({});
    });

    it('should handle legacy breadcrumbs format (array to object)', () => {
      const state = {
        breadcrumbs: [{ label: 'Home' }, { label: 'Page' }],
      };
      const result = normalizeState(state);
      expect(result.breadcrumbs).toEqual({
        default: [{ label: 'Home' }, { label: 'Page' }],
      });
    });

    it('should preserve breadcrumbs object format', () => {
      const state = {
        breadcrumbs: {
          admin: [{ label: 'Admin' }],
          user: [{ label: 'User' }],
        },
      };
      const result = normalizeState(state);
      expect(result.breadcrumbs).toEqual(state.breadcrumbs);
    });

    it('should clone state for mutability', () => {
      const state = { drawers: {}, breadcrumbs: {}, flashMessage: null };
      const result = normalizeState(state);
      expect(result).not.toBe(state);
    });
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = reducer(undefined, { type: '@@INIT' });
      expect(state).toEqual({
        drawers: {},
        breadcrumbs: {},
        flashMessage: null,
      });
    });
  });

  describe('Drawer Actions', () => {
    it('should toggle default drawer', () => {
      let state = reducer(undefined, toggleDrawer());
      expect(state.drawers.default).toBe(true);

      state = reducer(state, toggleDrawer());
      expect(state.drawers.default).toBe(false);
    });

    it('should toggle namespaced drawer', () => {
      let state = reducer(undefined, toggleDrawer('admin'));
      expect(state.drawers.admin).toBe(true);
      expect(state.drawers.default).toBeUndefined();

      state = reducer(state, toggleDrawer('admin'));
      expect(state.drawers.admin).toBe(false);
    });

    it('should handle multiple drawers independently', () => {
      let state = reducer(undefined, toggleDrawer('admin'));
      state = reducer(state, toggleDrawer('user'));

      expect(state.drawers.admin).toBe(true);
      expect(state.drawers.user).toBe(true);

      state = reducer(state, toggleDrawer('admin'));
      expect(state.drawers.admin).toBe(false);
      expect(state.drawers.user).toBe(true);
    });
  });

  describe('Flash Message Actions', () => {
    it('should set flash message', () => {
      const message = {
        variant: 'info',
        message: 'Test message',
        title: 'Test',
      };
      const state = reducer(undefined, setFlashMessage(message));
      expect(state.flashMessage).toEqual(message);
    });

    it('should clear flash message', () => {
      let state = reducer(
        undefined,
        setFlashMessage({ variant: 'info', message: 'Test' }),
      );
      state = reducer(state, clearFlashMessage());
      expect(state.flashMessage).toBeNull();
    });

    it('should show success message', () => {
      const state = reducer(
        undefined,
        showSuccessMessage({ message: 'Success!' }),
      );
      expect(state.flashMessage).toEqual({
        message: 'Success!',
        variant: 'success',
      });
    });

    it('should show error message', () => {
      const state = reducer(undefined, showErrorMessage({ message: 'Error!' }));
      expect(state.flashMessage).toEqual({
        message: 'Error!',
        variant: 'error',
      });
    });

    it('should show warning message', () => {
      const state = reducer(
        undefined,
        showWarningMessage({ message: 'Warning!' }),
      );
      expect(state.flashMessage).toEqual({
        message: 'Warning!',
        variant: 'warning',
      });
    });

    it('should show info message', () => {
      const state = reducer(undefined, showInfoMessage({ message: 'Info!' }));
      expect(state.flashMessage).toEqual({
        message: 'Info!',
        variant: 'info',
      });
    });
  });

  describe('Breadcrumb Actions', () => {
    describe('setBreadcrumbs', () => {
      it('should reset namespace with string argument', () => {
        let state = reducer(
          undefined,
          setBreadcrumbs({
            admin: [{ label: 'Admin' }, { label: 'Users' }],
          }),
        );
        state = reducer(state, setBreadcrumbs('admin'));
        expect(state.breadcrumbs.admin).toEqual([]);
      });

      it('should set single breadcrumb item', () => {
        const state = reducer(
          undefined,
          setBreadcrumbs({ admin: { label: 'Dashboard', url: '/admin' } }),
        );
        expect(state.breadcrumbs.admin).toEqual([
          { label: 'Dashboard', url: '/admin' },
        ]);
      });

      it('should set array of breadcrumb items', () => {
        const items = [
          { label: 'Home', url: '/' },
          { label: 'Admin', url: '/admin' },
        ];
        const state = reducer(undefined, setBreadcrumbs({ admin: items }));
        expect(state.breadcrumbs.admin).toEqual(items);
      });

      it('should handle multiple namespaces', () => {
        const state = reducer(
          undefined,
          setBreadcrumbs({
            admin: [{ label: 'Admin' }],
            user: [{ label: 'User' }],
          }),
        );
        expect(state.breadcrumbs.admin).toEqual([{ label: 'Admin' }]);
        expect(state.breadcrumbs.user).toEqual([{ label: 'User' }]);
      });
    });

    describe('addBreadcrumb', () => {
      it('should add single breadcrumb to namespace', () => {
        const state = reducer(
          undefined,
          addBreadcrumb({ label: 'Home' }, 'admin'),
        );
        expect(state.breadcrumbs.admin).toEqual([{ label: 'Home' }]);
      });

      it('should add multiple breadcrumbs to existing', () => {
        let state = reducer(
          undefined,
          addBreadcrumb({ label: 'Home' }, 'admin'),
        );
        state = reducer(state, addBreadcrumb({ label: 'Users' }, 'admin'));
        expect(state.breadcrumbs.admin).toEqual([
          { label: 'Home' },
          { label: 'Users' },
        ]);
      });

      it('should add array of breadcrumbs', () => {
        const state = reducer(
          undefined,
          addBreadcrumb([{ label: 'Home' }, { label: 'Admin' }], 'admin'),
        );
        expect(state.breadcrumbs.admin).toEqual([
          { label: 'Home' },
          { label: 'Admin' },
        ]);
      });

      it('should use default namespace when not specified', () => {
        const state = reducer(undefined, addBreadcrumb({ label: 'Home' }));
        expect(state.breadcrumbs.default).toEqual([{ label: 'Home' }]);
      });
    });

    describe('clearBreadcrumbs', () => {
      it('should clear breadcrumbs for namespace', () => {
        let state = reducer(
          undefined,
          setBreadcrumbs({ admin: [{ label: 'Admin' }] }),
        );
        state = reducer(state, clearBreadcrumbs('admin'));
        expect(state.breadcrumbs.admin).toEqual([]);
      });

      it('should not affect other namespaces', () => {
        let state = reducer(
          undefined,
          setBreadcrumbs({
            admin: [{ label: 'Admin' }],
            user: [{ label: 'User' }],
          }),
        );
        state = reducer(state, clearBreadcrumbs('admin'));
        expect(state.breadcrumbs.admin).toEqual([]);
        expect(state.breadcrumbs.user).toEqual([{ label: 'User' }]);
      });
    });
  });

  describe('Legacy Action Compatibility', () => {
    it('should handle FLASH_MESSAGE action', () => {
      const state = reducer(undefined, {
        type: 'FLASH_MESSAGE',
        payload: { variant: 'info', message: 'Test' },
      });
      expect(state.flashMessage).toEqual({
        variant: 'info',
        message: 'Test',
      });
    });

    it('should handle FLASH_MESSAGE_CLEAR action', () => {
      let state = reducer(
        undefined,
        setFlashMessage({ variant: 'info', message: 'Test' }),
      );
      state = reducer(state, { type: 'FLASH_MESSAGE_CLEAR' });
      expect(state.flashMessage).toBeNull();
    });

    it('should handle FLASH_MESSAGE_SUCCESS action', () => {
      const state = reducer(undefined, {
        type: 'FLASH_MESSAGE_SUCCESS',
        payload: { message: 'Success' },
      });
      expect(state.flashMessage).toEqual({
        variant: 'success',
        message: 'Success',
      });
    });

    it('should handle FLASH_MESSAGE_ERROR action', () => {
      const state = reducer(undefined, {
        type: 'FLASH_MESSAGE_ERROR',
        payload: { message: 'Error' },
      });
      expect(state.flashMessage).toEqual({
        variant: 'error',
        message: 'Error',
      });
    });

    it('should handle FLASH_MESSAGE_WARNING action', () => {
      const state = reducer(undefined, {
        type: 'FLASH_MESSAGE_WARNING',
        payload: { message: 'Warning' },
      });
      expect(state.flashMessage).toEqual({
        variant: 'warning',
        message: 'Warning',
      });
    });

    it('should handle FLASH_MESSAGE_INFO action', () => {
      const state = reducer(undefined, {
        type: 'FLASH_MESSAGE_INFO',
        payload: { message: 'Info' },
      });
      expect(state.flashMessage).toEqual({
        variant: 'info',
        message: 'Info',
      });
    });

    it('should handle TOGGLE_DRAWER action', () => {
      let state = reducer(undefined, {
        type: 'TOGGLE_DRAWER',
        payload: 'admin',
      });
      expect(state.drawers.admin).toBe(true);

      state = reducer(state, { type: 'TOGGLE_DRAWER', payload: 'admin' });
      expect(state.drawers.admin).toBe(false);
    });
  });

  describe('resetUiState', () => {
    it('should reset to initial state', () => {
      let state = reducer(undefined, toggleDrawer('admin'));
      state = reducer(state, showSuccessMessage({ message: 'Test' }));
      state = reducer(state, setBreadcrumbs({ admin: [{ label: 'Admin' }] }));

      state = reducer(state, resetUiState());

      expect(state).toEqual({
        drawers: {},
        breadcrumbs: {},
        flashMessage: null,
      });
    });
  });

  describe('State Immutability', () => {
    it('should not mutate original state', () => {
      const initialState = reducer(undefined, { type: '@@INIT' });
      const originalState = { ...initialState };
      reducer(initialState, toggleDrawer('admin'));
      expect(initialState).toEqual(originalState);
    });
  });
});
