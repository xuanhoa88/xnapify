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
  Fragment,
} from 'react';

import { Flex, Box, Text, Badge, Separator, Card } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import Modal from '@shared/renderer/components/Modal';

import {
  fetchGroupPermissions,
  isGroupFetchPermissionsLoading,
} from '../redux';

const GroupPermissionsModal = forwardRef((props, ref) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const loading = useSelector(isGroupFetchPermissionsLoading);

  // Data state
  const [permissions, setPermissions] = useState([]);
  const [roleDetails, setRoleDetails] = useState([]);

  // Internal state
  const [isOpen, setIsOpen] = useState(false);
  const [group, setGroup] = useState(null);

  // Fetch permissions when modal opens
  useEffect(() => {
    if (isOpen && group) {
      const loadPermissions = async () => {
        try {
          const data = await dispatch(fetchGroupPermissions(group.id)).unwrap();
          setPermissions(data.permissions || []);
          setRoleDetails(data.roleDetails || []);
        } catch (err) {
          // Silently handle error
        }
      };
      loadPermissions();
    }
  }, [dispatch, isOpen, group]);

  // Reset state helper
  const resetState = useCallback(() => {
    setIsOpen(false);
    setGroup(null);
    setPermissions([]);
    setRoleDetails([]);
  }, []);

  // Expose methods via ref
  useImperativeHandle(
    ref,
    () => ({
      open: targetGroup => {
        setGroup(targetGroup);
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
        {t('admin:groups.permissionsFor', 'Permissions for "{{groupName}}"', {
          groupName:
            (group && group.name) || t('admin:common.unknown', 'Unknown'),
        })}
      </Modal.Header>
      <Modal.Body>
        <Modal.Description className='mb-4 text-[var(--gray-11)]'>
          {t(
            'admin:groups.permissionsDescription',
            "These permissions are inherited from the group's assigned roles.",
          )}
        </Modal.Description>

        {loading ? (
          <Flex justify='center' align='center' py='8'>
            <Text size='2' color='gray'>
              {t('admin:common.loadingPermissions', 'Loading permissions...')}
            </Text>
          </Flex>
        ) : (
          <Flex direction='column' gap='6'>
            {/* Role breakdown */}
            {roleDetails.length > 0 && (
              <Box>
                <Flex align='center' gap='2' mb='4'>
                  <Text as='h4' size='3' weight='bold'>
                    {t('admin:groups.assignedRoles', 'Assigned Roles')}
                  </Text>
                </Flex>
                <Card size='2' className='shadow-sm'>
                  <Flex direction='column' gap='3'>
                    {roleDetails.map((role, index) => (
                      <Fragment key={role.id || role.name}>
                        <Flex justify='between' align='center'>
                          <Text size='2' weight='bold' highContrast>
                            {role.name}
                          </Text>
                          <Badge
                            variant='soft'
                            color='gray'
                            size='1'
                            highContrast
                          >
                            {t(
                              'admin:roles.permissionCount',
                              '{{count}} permission',
                              {
                                count: role.permissions.length,
                                defaultValue_other: '{{count}} permissions',
                              },
                            )}
                          </Badge>
                        </Flex>
                        {index < roleDetails.length - 1 && (
                          <Separator size='4' />
                        )}
                      </Fragment>
                    ))}
                  </Flex>
                </Card>
              </Box>
            )}

            {roleDetails.length > 0 && <Separator size='4' />}

            {/* All permissions */}
            <Box>
              <Flex align='center' gap='2' mb='4'>
                <Text as='h4' size='3' weight='bold'>
                  {t(
                    'admin:groups.effectivePermissions',
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
                      key={perm.id}
                      variant='soft'
                      color='gray'
                      size='2'
                      radius='medium'
                      highContrast
                    >
                      {perm.resource}:{perm.action}
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
                      'admin:groups.noPermissionsAssigned',
                      'No permissions. Assign roles to grant permissions.',
                    )}
                  </Text>
                </Flex>
              )}
            </Box>
          </Flex>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Modal.Button onClick={handleClose}>
          {t('admin:common.close', 'Close')}
        </Modal.Button>
      </Modal.Footer>
    </Modal>
  );
});

GroupPermissionsModal.displayName = 'GroupPermissionsModal';

export default GroupPermissionsModal;
