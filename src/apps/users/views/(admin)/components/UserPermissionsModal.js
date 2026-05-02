/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  useState,
  useCallback,
  useImperativeHandle,
  forwardRef,
  useEffect,
  useMemo,
} from 'react';

import { Box, Flex, Text, Badge, Card, Separator } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import Modal from '@shared/renderer/components/Modal';

import {
  fetchUserPermissions,
  clearUserPermissions,
  getUserPermissions,
  isUserPermissionsOperationLoading,
} from '../redux';

/**
 * UserPermissionsModal - Self-contained modal for viewing user permissions
 *
 * Displays all permissions inherited from the user's assigned roles and groups.
 * Uses the dedicated /api/admin/users/:id/permissions endpoint.
 *
 * Usage:
 *   const permissionsModalRef = useRef();
 *   permissionsModalRef.current.open(user);      // Open for user
 *   permissionsModalRef.current.close();         // Close modal
 */
const UserPermissionsModal = forwardRef((props, ref) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const permissions = useSelector(getUserPermissions);
  const loading = useSelector(isUserPermissionsOperationLoading);

  // Internal state
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState(null);

  // Fetch permissions when user changes
  useEffect(() => {
    if (isOpen && user) {
      dispatch(fetchUserPermissions(user.id));
    }
    return () => {
      if (!isOpen) {
        dispatch(clearUserPermissions());
      }
    };
  }, [dispatch, isOpen, user]);

  // Calculate role details from user's roles (already available in user object)
  const roleDetails = useMemo(() => {
    if (!user || !user.roles) {
      return [];
    }

    const userRoles = Array.isArray(user.roles) ? user.roles : [];

    return userRoles.map(role => ({
      id: role.id || role,
      name: typeof role === 'string' ? role : role.name,
      // Use permissions count from role object if available
      permissionCount: role.permissions ? role.permissions.length : 0,
    }));
  }, [user]);

  // Calculate group details from user's groups
  const groupDetails = useMemo(() => {
    if (!user || !user.groups) {
      return [];
    }

    const userGroups = Array.isArray(user.groups) ? user.groups : [];

    return userGroups.map(group => ({
      id: group.id || group,
      name: typeof group === 'string' ? group : group.name,
    }));
  }, [user]);

  // Reset state helper
  const resetState = useCallback(() => {
    setIsOpen(false);
    setUser(null);
    dispatch(clearUserPermissions());
  }, [dispatch]);

  // Expose methods via ref
  useImperativeHandle(
    ref,
    () => ({
      open: targetUser => {
        setUser(targetUser);
        setIsOpen(true);
      },
      close: resetState,
    }),
    [resetState],
  );

  const handleClose = useCallback(() => {
    resetState();
  }, [resetState]);

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <Modal.Header onClose={handleClose}>
        {t('admin:users.permissions.title', 'Permissions for "{{name}}"', {
          name:
            (user &&
              ((user.profile && user.profile.display_name) || user.email)) ||
            t('admin:common.unknown', 'Unknown'),
        })}
      </Modal.Header>
      <Modal.Body>
        <Modal.Description className='mb-4 text-[var(--gray-11)]'>
          {t(
            'admin:users.permissions.description',
            "These permissions are inherited from the user's assigned roles and groups.",
          )}
        </Modal.Description>

        {loading ? (
          <Flex justify='center' align='center' py='8'>
            <Text size='2' color='gray'>
              {t('admin:users.permissions.loading', 'Loading permissions...')}
            </Text>
          </Flex>
        ) : (
          <>
            <Flex direction='column' gap='6'>
              {/* Inherited Sources */}
              {(roleDetails.length > 0 || groupDetails.length > 0) && (
                <Box>
                  <Flex align='center' gap='2' mb='4'>
                    <Text as='h4' size='3' weight='bold'>
                      {t(
                        'admin:users.permissions.inheritanceSources',
                        'Inherited From',
                      )}
                    </Text>
                  </Flex>
                  <Card size='2' className='shadow-sm'>
                    <Flex direction='column' gap='3'>
                      {roleDetails.length > 0 && (
                        <Flex align='start' gap='3'>
                          <Text size='2' color='gray' className='w-20 mt-0.5'>
                            {t('admin:users.permissions.rolesLabel', 'Roles:')}
                          </Text>
                          <Flex wrap='wrap' gap='2' className='flex-1'>
                            {roleDetails.map(role => (
                              <Badge
                                key={role.id || role.name}
                                color='indigo'
                                variant='soft'
                                highContrast
                                size='2'
                              >
                                {role.name}
                              </Badge>
                            ))}
                          </Flex>
                        </Flex>
                      )}

                      {groupDetails.length > 0 && (
                        <Flex align='start' gap='3'>
                          <Text size='2' color='gray' className='w-20 mt-0.5'>
                            {t(
                              'admin:users.permissions.groupsLabel',
                              'Groups:',
                            )}
                          </Text>
                          <Flex wrap='wrap' gap='2' className='flex-1'>
                            {groupDetails.map(group => (
                              <Badge
                                key={group.id || group.name}
                                color='cyan'
                                variant='soft'
                                highContrast
                                size='2'
                              >
                                {group.name}
                              </Badge>
                            ))}
                          </Flex>
                        </Flex>
                      )}
                    </Flex>
                  </Card>
                </Box>
              )}

              {(roleDetails.length > 0 || groupDetails.length > 0) && (
                <Separator size='4' />
              )}

              {/* All permissions */}
              <Box>
                <Flex align='center' gap='2' mb='4'>
                  <Text as='h4' size='3' weight='bold'>
                    {t(
                      'admin:users.permissions.effectivePermissions',
                      'Effective Permissions',
                    )}
                  </Text>
                  <Badge variant='soft' color='indigo' size='1' radius='full'>
                    {permissions.length}
                  </Badge>
                </Flex>
                {permissions.length > 0 ? (
                  <Flex wrap='wrap' gap='2'>
                    {permissions.map(perm => (
                      <Badge
                        key={perm.name}
                        size='2'
                        color='gray'
                        radius='medium'
                        variant='soft'
                        highContrast
                      >
                        {perm.name}
                      </Badge>
                    ))}
                  </Flex>
                ) : (
                  <Flex
                    justify='center'
                    align='center'
                    p='6'
                    className='border border-dashed border-[var(--gray-a6)] rounded-md'
                  >
                    <Text size='2' color='gray'>
                      {t(
                        'admin:users.permissions.noPermissions',
                        'No permissions. Assign roles to grant permissions.',
                      )}
                    </Text>
                  </Flex>
                )}
              </Box>
            </Flex>
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Modal.Button onClick={handleClose}>
          {t('admin:users.permissions.close', 'Close')}
        </Modal.Button>
      </Modal.Footer>
    </Modal>
  );
});

UserPermissionsModal.displayName = 'UserPermissionsModal';

export default UserPermissionsModal;
