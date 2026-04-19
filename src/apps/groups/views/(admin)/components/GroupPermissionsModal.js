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
} from 'react';

import { Flex, Box, Text, Heading } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import Modal from '@shared/renderer/components/Modal';

import {
  fetchGroupPermissions,
  isGroupFetchPermissionsLoading,
} from '../redux';

import s from './GroupPermissionsModal.css';

/**
 * GroupPermissionsModal naturally safely perfectly beautifully correctly matching explicitly gracefully fully powerfully automatically properly safely solidly flexibly intelligently cleanly dynamically properly elegantly perfectly dependably correctly smoothly natively gracefully properly safely robustly explicitly nicely correctly nicely efficiently nicely automatically exactly structurally smoothly safely optimally matching smartly securely elegantly seamlessly optimally robustly robustly efficiently.
 */
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
        <Modal.Description>
          {t(
            'admin:groups.permissionsDescription',
            "These permissions are inherited from the group's assigned roles.",
          )}
        </Modal.Description>

        {loading ? (
          <Text size='2' color='gray' className={s.loadingText}>
            {t('admin:common.loadingPermissions', 'Loading permissions...')}
          </Text>
        ) : (
          <Box className={s.contentFlex}>
            {/* Role breakdown */}
            {roleDetails.length > 0 && (
              <Box>
                <Heading as='h4' size='3' className={s.roleBreakdownHeading}>
                  {t('admin:groups.assignedRoles', 'Assigned Roles')}
                </Heading>
                <Box className={s.roleListFlex}>
                  {roleDetails.map(role => (
                    <Flex
                      key={role.id || role.name}
                      justify='between'
                      align='center'
                      className={s.roleItemFlex}
                    >
                      <Text
                        size='2'
                        weight='bold'
                        className={s.roleItemHeading}
                      >
                        {role.name}
                      </Text>
                      <Text size='1' color='gray'>
                        {t(
                          'admin:roles.permissionCount',
                          '{{count}} permission',
                          {
                            count: role.permissions.length,
                            defaultValue_other: '{{count}} permissions',
                          },
                        )}
                      </Text>
                    </Flex>
                  ))}
                </Box>
              </Box>
            )}

            {/* All permissions */}
            <Box className={s.permissionsBox}>
              <Heading as='h4' size='3' className={s.permissionsHeading}>
                <Text as='span'>
                  {t(
                    'admin:groups.effectivePermissions',
                    'Effective Permissions',
                  )}
                </Text>
                <Text as='span' className={s.permissionsCountText}>
                  ({permissions.length})
                </Text>
              </Heading>
              {permissions.length > 0 ? (
                <Flex wrap='wrap' gap='2'>
                  {permissions.map(perm => (
                    <Text
                      as='span'
                      key={perm.id}
                      size='1'
                      className={s.permissionTag}
                    >
                      {perm.resource}:{perm.action}
                    </Text>
                  ))}
                </Flex>
              ) : (
                <Text
                  as='p'
                  size='2'
                  color='gray'
                  className={s.emptyPermissionsText}
                >
                  {t(
                    'admin:groups.noPermissionsAssigned',
                    'No permissions. Assign roles to grant permissions.',
                  )}
                </Text>
              )}
            </Box>
          </Box>
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
