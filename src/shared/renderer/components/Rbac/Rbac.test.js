/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/* eslint-env jest */
/* eslint-disable react/prop-types */

import renderer from 'react-test-renderer';
import { useSelector } from 'react-redux';
import Rbac from '.';

// Mock react-redux
jest.mock('react-redux', () => ({
  useSelector: jest.fn(),
}));

describe('Rbac Component', () => {
  const mockUser = {
    id: '1',
    roles: ['user'],
    permissions: ['posts:read', 'comments:create'],
  };

  beforeEach(() => {
    useSelector.mockImplementation(selector =>
      selector({ user: { data: mockUser } }),
    );
    useSelector.mockReturnValue(mockUser);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('renders children when no permission or role is required', () => {
    const component = renderer.create(
      <Rbac>
        <div>Protected Content</div>
      </Rbac>,
    );
    const tree = component.toJSON();
    expect(tree).toMatchSnapshot();
    // Check content manually if snapshot is not enough or for TDD
    expect(tree.children).toContain('Protected Content');
  });

  test('renders children when user has required permission', () => {
    const component = renderer.create(
      <Rbac permission='posts:read'>
        <div>Protected Content</div>
      </Rbac>,
    );
    expect(component.toJSON().children).toContain('Protected Content');
  });

  test('renders fallback when user is missing required permission', () => {
    const component = renderer.create(
      <Rbac permission='posts:delete' fallback={<div>Access Denied</div>}>
        <div>Protected Content</div>
      </Rbac>,
    );
    expect(component.toJSON().children).toContain('Access Denied');
  });

  test('renders children when user has required role', () => {
    const component = renderer.create(
      <Rbac roles='user'>
        <div>Protected Content</div>
      </Rbac>,
    );
    expect(component.toJSON().children).toContain('Protected Content');
  });

  test('renders fallback when user is missing required role', () => {
    const component = renderer.create(
      <Rbac roles='admin' fallback={<div>Access Denied</div>}>
        <div>Protected Content</div>
      </Rbac>,
    );
    expect(component.toJSON().children).toContain('Access Denied');
  });

  test('renders children when user has any of the array permissions', () => {
    const component = renderer.create(
      <Rbac permission={['posts:delete', 'posts:read']}>
        <div>Protected Content</div>
      </Rbac>,
    );
    expect(component.toJSON().children).toContain('Protected Content');
  });

  describe('Wildcard Permissions', () => {
    test('Super admin (*:*) accesses everything', () => {
      useSelector.mockReturnValue({ ...mockUser, permissions: ['*:*'] });

      const component = renderer.create(
        <Rbac permission='anything:delete'>
          <div>Protected Content</div>
        </Rbac>,
      );
      expect(component.toJSON().children).toContain('Protected Content');
    });

    test('Resource admin (users:*) accesses any action on resource', () => {
      useSelector.mockReturnValue({ ...mockUser, permissions: ['users:*'] });

      const component = renderer.create(
        <Rbac permission='users:delete'>
          <div>Protected Content</div>
        </Rbac>,
      );
      expect(component.toJSON().children).toContain('Protected Content');
    });

    test('Action admin (*:read) accesses read on any resource', () => {
      useSelector.mockReturnValue({ ...mockUser, permissions: ['*:read'] });

      const component = renderer.create(
        <Rbac permission='secrets:read'>
          <div>Protected Content</div>
        </Rbac>,
      );
      expect(component.toJSON().children).toContain('Protected Content');
    });
  });

  describe('Group and Ownership Permissions', () => {
    test('renders children when user has any of the array permissions (specific mock)', () => {
      useSelector.mockReturnValue({
        permissions: ['posts:read'],
      });
      const component = renderer.create(
        <Rbac permission={['posts:read', 'posts:delete']}>
          <div>Protected Content</div>
        </Rbac>,
      );
      expect(component.toJSON().children).toContain('Protected Content');
    });

    test('renders children when user has required group', () => {
      useSelector.mockReturnValue({
        groups: [{ name: 'developers' }],
      });
      const component = renderer.create(
        <Rbac groups='developers'>
          <div>Protected Content</div>
        </Rbac>,
      );
      expect(component.toJSON().children).toContain('Protected Content');
    });

    test('renders fallback when user is missing required group', () => {
      useSelector.mockReturnValue({
        groups: [{ name: 'designers' }],
      });
      const component = renderer.create(
        <Rbac groups='developers' fallback={<div>Access Denied</div>}>
          <div>Protected Content</div>
        </Rbac>,
      );
      expect(component.toJSON().children).toContain('Access Denied');
    });

    test('renders children when user is owner', () => {
      useSelector.mockReturnValue({
        id: '123',
      });
      const component = renderer.create(
        <Rbac ownerId='123'>
          <div>Protected Content</div>
        </Rbac>,
      );
      expect(component.toJSON().children).toContain('Protected Content');
    });

    test('renders fallback when user is not owner', () => {
      useSelector.mockReturnValue({
        id: '456',
      });
      const component = renderer.create(
        <Rbac ownerId='123' fallback={<div>Access Denied</div>}>
          <div>Protected Content</div>
        </Rbac>,
      );
      expect(component.toJSON().children).toContain('Access Denied');
    });
  });
});
