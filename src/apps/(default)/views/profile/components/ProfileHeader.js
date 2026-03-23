/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useRef, useCallback, useMemo, useEffect } from 'react';

import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { useSelector, useDispatch } from 'react-redux';

import Icon from '@shared/renderer/components/Icon';
import {
  getUserProfile,
  getUserAvatarUrl,
  uploadUserAvatar,
  isAvatarLoading,
  getAvatarError,
  clearAvatarError,
} from '@shared/renderer/redux';

import s from './ProfileHeader.css';

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
    <div className={s.profileHeader}>
      <div className={s.avatarSection}>
        <div
          className={clsx(s.avatarWrapper, { [s.avatarLoading]: loading })}
          onClick={handleAvatarClick}
          role='button'
          tabIndex={0}
          onKeyDown={e => {
            if (e.key === 'Enter') handleAvatarClick();
          }}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt='Profile' className={s.avatarImg} />
          ) : (
            <div className={s.avatar}>{avatarInitial}</div>
          )}
          <div className={s.avatarOverlay}>
            {loading ? (
              <Icon name='loader' size={24} />
            ) : (
              <Icon name='camera' size={24} />
            )}
          </div>
        </div>
        <input
          type='file'
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleFileChange}
          accept='image/*'
          disabled={loading}
        />
        {error && (
          <div className={clsx(s.avatarMessage, s.avatarError)}>{error}</div>
        )}
      </div>

      <div className={s.userInfo}>
        <h1 className={s.userName}>
          {displayName || t('navigation.profile', 'Profile')}
        </h1>
        <p className={s.userEmail}>{(user && user.email) || ''}</p>
        <div className={s.userStats}>
          <div className={s.statItem}>
            <span className={s.statValue}>
              {(user && Array.isArray(user.roles) && user.roles.length) || 0}
            </span>
            <span className={s.statLabel}>{t('profile.roles', 'Roles')}</span>
          </div>
          <div className={s.statItem}>
            <span className={s.statValue}>
              {(user && Array.isArray(user.groups) && user.groups.length) || 0}
            </span>
            <span className={s.statLabel}>{t('profile.groups', 'Groups')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProfileHeader;
