/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useRef, useCallback, useMemo, useEffect } from 'react';

import { ReloadIcon, CameraIcon } from '@radix-ui/react-icons';
import { Flex, Box, Text, Heading } from '@radix-ui/themes';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { useSelector, useDispatch } from 'react-redux';

import { features } from '@shared/renderer/redux/index.js';

import s from './ProfileHeader.css';

const {
  getUserProfile,
  getUserAvatarUrl,
  uploadUserAvatar,
  isAvatarLoading,
  getAvatarError,
  clearAvatarError,
} = features;

/**
 * ProfileHeader with cover gradient, avatar ring, and stat badges.
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

  const rolesCount =
    (user && Array.isArray(user.roles) && user.roles.length) || 0;
  const groupsCount =
    (user && Array.isArray(user.groups) && user.groups.length) || 0;

  return (
    <Box className={s.headerContainer}>
      <Box className={s.coverBackground} />
      <Flex className={s.headerContent}>
        {/* Avatar */}
        <Flex direction='column' align='center' className={s.avatarSection}>
          <Box
            onClick={handleAvatarClick}
            role='button'
            tabIndex={0}
            onKeyDown={e => {
              if (e.key === 'Enter') handleAvatarClick();
            }}
            className={clsx(s.avatarBox, loading && s.avatarBoxLoading)}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt='Profile' className={s.avatarImg} />
            ) : (
              <Text>{avatarInitial}</Text>
            )}
            <Flex
              className={clsx(
                s.avatarOverlay,
                loading && s.avatarOverlayLoading,
              )}
              align='center'
              justify='center'
            >
              {loading ? (
                <ReloadIcon width={28} height={28} className={s.spinner} />
              ) : (
                <CameraIcon width={28} height={28} />
              )}
            </Flex>
          </Box>
          <input
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

        {/* Name, email, stats */}
        <Flex direction='column' grow='1' className={s.infoSection}>
          <Heading as='h1' size='7' mb='1' className={s.displayName}>
            {displayName || t('navigation.profile', 'Profile')}
          </Heading>
          <Text size='3' className={s.emailText}>
            {(user && user.email) || ''}
          </Text>

          <Box className={s.statsRow}>
            <Box className={s.statBadge}>
              <Text size='5' weight='bold' className={s.statValue}>
                {rolesCount}
              </Text>
              <Text className={s.statLabel}>{t('profile.roles', 'Roles')}</Text>
            </Box>
            <Box className={s.statBadge}>
              <Text size='5' weight='bold' className={s.statValue}>
                {groupsCount}
              </Text>
              <Text className={s.statLabel}>
                {t('profile.groups', 'Groups')}
              </Text>
            </Box>
          </Box>
        </Flex>
      </Flex>
    </Box>
  );
}

export default ProfileHeader;
