/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { checkPermission, hasRole, hasGroup, isOwner } from './middlewares';

describe('RBAC Utilities', () => {
  // Shared admin user fixture
  const adminUser = { is_admin: true, id: '999' };

  describe('checkPermission', () => {
    const user = {
      permissions: ['posts:read', 'users:*', '*:delete'],
    };

    const superAdmin = {
      permissions: ['*:*'],
    };

    it('should return false for invalid user or permissions', () => {
      expect(checkPermission(null, 'posts:read')).toBe(false);
      expect(checkPermission({}, 'posts:read')).toBe(false);
    });

    it('should match direct permissions', () => {
      expect(checkPermission(user, 'posts:read')).toBe(true);
      expect(checkPermission(user, 'posts:write')).toBe(false);
    });

    it('should match resource wildcard', () => {
      expect(checkPermission(user, 'users:create')).toBe(true);
      expect(checkPermission(user, 'users:update')).toBe(true);
      expect(checkPermission(user, 'groups:create')).toBe(false);
    });

    it('should match action wildcard', () => {
      expect(checkPermission(user, 'posts:delete')).toBe(true);
      expect(checkPermission(user, 'comments:delete')).toBe(true);
      expect(checkPermission(user, 'posts:update')).toBe(false);
    });

    it('should match super user wildcard', () => {
      expect(checkPermission(superAdmin, 'anything:action')).toBe(true);
    });

    it('should bypass all permission checks for is_admin users', () => {
      expect(checkPermission(adminUser, 'anything:whatever')).toBe(true);
      expect(checkPermission(adminUser, 'posts:read')).toBe(true);
      expect(checkPermission(adminUser, 'settings.general:write')).toBe(true);
    });

    it('should bypass permission checks for is_admin users without permissions array', () => {
      expect(checkPermission({ is_admin: true }, 'posts:read')).toBe(true);
    });
  });

  describe('hasRole', () => {
    const user = {
      roles: ['user', 'editor'],
    };

    it('should match single role', () => {
      expect(hasRole(user, 'user')).toBe(true);
      expect(hasRole(user, 'admin')).toBe(false);
    });

    it('should match array of roles (OR condition)', () => {
      expect(hasRole(user, ['admin', 'editor'])).toBe(true);
      expect(hasRole(user, ['admin', 'guest'])).toBe(false);
    });

    it('should bypass role checks for is_admin users', () => {
      expect(hasRole(adminUser, 'moderator')).toBe(true);
      expect(hasRole(adminUser, ['moderator', 'superadmin'])).toBe(true);
    });

    it('should bypass role checks for is_admin users without roles array', () => {
      expect(hasRole({ is_admin: true }, 'moderator')).toBe(true);
    });
  });

  describe('hasGroup', () => {
    const user = {
      groups: [{ name: 'developers' }, 'designers'],
    };

    it('should match single group', () => {
      expect(hasGroup(user, 'developers')).toBe(true);
      expect(hasGroup(user, 'designers')).toBe(true);
      expect(hasGroup(user, 'marketing')).toBe(false);
    });

    it('should match array of groups (OR condition)', () => {
      expect(hasGroup(user, ['developers', 'marketing'])).toBe(true);
      expect(hasGroup(user, ['hr', 'sales'])).toBe(false);
    });

    it('should handle missing groups', () => {
      expect(hasGroup({}, 'developers')).toBe(false);
    });

    it('should bypass group checks for is_admin users', () => {
      expect(hasGroup(adminUser, 'engineering')).toBe(true);
      expect(hasGroup(adminUser, ['engineering', 'design'])).toBe(true);
    });

    it('should bypass group checks for is_admin users without groups array', () => {
      expect(hasGroup({ is_admin: true }, 'engineering')).toBe(true);
    });
  });

  describe('isOwner', () => {
    const user = { id: '123' };

    it('should return true if IDs match', () => {
      expect(isOwner(user, '123')).toBe(true);
      expect(isOwner(user, 123)).toBe(true);
    });

    it('should return false if IDs do not match', () => {
      expect(isOwner(user, '456')).toBe(false);
    });

    it('should return false if user is missing', () => {
      expect(isOwner(null, '123')).toBe(false);
    });

    it('should bypass ownership checks for is_admin users', () => {
      expect(isOwner(adminUser, '456')).toBe(true);
      expect(isOwner(adminUser, 'any-resource-id')).toBe(true);
    });
  });
});
