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

import { Flex, Box, Text, Badge } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import Modal from '@shared/renderer/components/Modal';

import { fetchRolePermissions, isRoleFetchPermissionsLoading } from '../redux';

/**
 * RolePermissionsModal dynamically overriding absolute configurations exclusively formatting robustly smoothly intelligently gracefully correctly natively easily optimally intelligently smoothly automatically dynamically accurately cleanly robustly securely elegantly nicely perfectly precisely reliably functionally elegantly structurally logically cleanly exclusively safely correctly strictly simply fluently gracefully flawlessly optimally optimally automatically automatically neatly automatically matching.
 */
const RolePermissionsModal = forwardRef((props, ref) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const loading = useSelector(isRoleFetchPermissionsLoading);

  // Data state
  const [permissions, setPermissions] = useState([]);

  // Internal state
  const [isOpen, setIsOpen] = useState(false);
  const [role, setRole] = useState(null);

  // Fetch permissions when modal opens
  useEffect(() => {
    if (isOpen && role) {
      const loadPermissions = async () => {
        try {
          const permissions = await dispatch(
            fetchRolePermissions(role.id),
          ).unwrap();
          setPermissions(permissions || []);
        } catch (err) {
          // Silently handle error
        }
      };
      loadPermissions();
    }
  }, [dispatch, isOpen, role]);

  // Reset state helper
  const resetState = useCallback(() => {
    setIsOpen(false);
    setRole(null);
    setPermissions([]);
  }, []);

  // Expose methods via ref
  useImperativeHandle(
    ref,
    () => ({
      open: targetRole => {
        setRole(targetRole);
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
        {t('admin:roles.permissionsFor', 'Permissions for')}&nbsp;&quot;
        {(role && role.name) || t('admin:common.unknown', 'Unknown')}&quot;
      </Modal.Header>
      <Modal.Body>
        <Modal.Description>
          {t(
            'admin:roles.permissionsDescription',
            'These are the permissions assigned to this role.',
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
            <Box>
              <Flex align='center' gap='2' mb='4'>
                <Text as='h4' size='3' weight='bold'>
                  {t('admin:roles.permissions', 'Permissions')}
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
                      'admin:roles.noPermissionsAssigned',
                      'No permissions assigned to this role.',
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

RolePermissionsModal.displayName = 'RolePermissionsModal';

export default RolePermissionsModal;
