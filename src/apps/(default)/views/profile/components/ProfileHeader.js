/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useRef, useCallback, useMemo, useEffect } from 'react';

import { ReloadIcon, CameraIcon } from '@radix-ui/react-icons';
import { Flex, Box, Text, Heading } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import { useSelector, useDispatch } from 'react-redux';

import {
  getUserProfile,
  getUserAvatarUrl,
  uploadUserAvatar,
  isAvatarLoading,
  getAvatarError,
  clearAvatarError,
} from '@shared/renderer/redux';

import s from './ProfileHeader.css';

/**
 * ProfileHeader strictly rendered with explicit React structures bypassing CSS Module imports.
 */
function ProfileHeader() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const user = useSelector(getUserProfile);
  const avatarUrl = useSelector(getUserAvatarUrl);
  const loading = useSelector(isAvatarLoading);
  const error = useSelector(getAvatarError);
  const fileInputRef = useRef(null);

  // Clear error on unmount
  useEffect(() => {
    return () => {
      dispatch(clearAvatarError());
    };
  }, [dispatch]);

  const displayName = useMemo(() => {
    if (!user) return '';
    return user.profile && user.profile.display_name
      ? user.profile.display_name
      : user.email;
  }, [user]);

  const avatarInitial = useMemo(
    () => (displayName ? displayName.charAt(0).toUpperCase() : 'U'),
    [displayName],
  );

  const handleAvatarClick = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, []);

  const handleFileChange = useCallback(
    async e => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        await dispatch(uploadUserAvatar(file)).unwrap();
      } catch {
        // Error is handled by Redux state
      } finally {
        e.target.value = '';
      }
    },
    [dispatch],
  );

  return (
    <Flex align='center' gap='5' className={s.headerContainer}>
      <Flex direction='column' align='center' className={s.avatarSection}>
        <Box
          onClick={handleAvatarClick}
          role='button'
          tabIndex={0}
          onKeyDown={e => {
            if (e.key === 'Enter') handleAvatarClick();
          }}
          className={`${s.avatarBox} ${loading ? s.avatarBoxLoading : ''}`}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt='Profile' className={s.avatarImg} />
          ) : (
            <Text>{avatarInitial}</Text>
          )}
          <Flex
            className={`${s.avatarOverlay} avatar-overlay ${loading ? s.avatarOverlayLoading : ''}`}
            align='center'
            justify='center'
          >
            {loading ? (
              <ReloadIcon width={32} height={32} className={s.spinner} />
            ) : (
              <CameraIcon width={32} height={32} />
            )}
          </Flex>
        </Box>
        <Box
          as='input'
          type='file'
          ref={fileInputRef}
          className={s.avatarInput}
          onChange={handleFileChange}
          accept='image/*'
          disabled={loading}
        />
        {error && (
          <Text size='2' color='red' align='center' className={s.errorText}>
            {error}
          </Text>
        )}
      </Flex>

      <Flex direction='column' className={s.infoSection}>
        <Heading as='h1' size='7' className={s.displayName}>
          {displayName || t('navigation.profile', 'Profile')}
        </Heading>
        <Text size='3' color='gray' className={s.emailText}>
          {(user && user.email) || ''}
        </Text>

        <Flex gap='5' justify={{ initial: 'center', md: 'start' }}>
          <Flex direction='column' align={{ initial: 'center', md: 'start' }}>
            <Text size='6' weight='bold' className={s.statValue}>
              {(user && Array.isArray(user.roles) && user.roles.length) || 0}
            </Text>
            <Text size='2' color='gray' weight='medium' className={s.statLabel}>
              {t('profile.roles', 'Roles')}
            </Text>
          </Flex>
          <Flex direction='column' align={{ initial: 'center', md: 'start' }}>
            <Text size='6' weight='bold' className={s.statValue}>
              {(user && Array.isArray(user.groups) && user.groups.length) || 0}
            </Text>
            <Text size='2' color='gray' weight='medium' className={s.statLabel}>
              {t('profile.groups', 'Groups')}
            </Text>
          </Flex>
        </Flex>
      </Flex>
    </Flex>
  );
}

export default ProfileHeader;
