/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import Icon from '../../../components/Icon';
import s from './ProfileHeader.css';

function ProfileHeader({
  user,
  avatarUrl,
  displayName,
  onAvatarUpload,
  loading,
}) {
  const { t } = useTranslation();
  const fileInputRef = useRef(null);

  const avatarInitial = useMemo(() => {
    return displayName ? displayName.charAt(0).toUpperCase() : 'U';
  }, [displayName]);

  const handleAvatarClick = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, []);

  const handleFileChange = useCallback(
    async e => {
      const file = e.target.files[0];
      if (!file) return;

      await onAvatarUpload(file);
      e.target.value = '';
    },
    [onAvatarUpload],
  );

  return (
    <div className={s.profileHeader}>
      <div className={s.avatarSection}>
        <div
          className={s.avatarWrapper}
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
            <Icon name='camera' size={24} />
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

ProfileHeader.propTypes = {
  user: PropTypes.shape({
    email: PropTypes.string,
    roles: PropTypes.array,
    groups: PropTypes.array,
  }),
  avatarUrl: PropTypes.string,
  displayName: PropTypes.string,
  onAvatarUpload: PropTypes.func.isRequired,
  loading: PropTypes.bool,
};

export default ProfileHeader;
