/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector, useDispatch } from 'react-redux';
import {
  getCurrentUser,
  getCurrentUserAvatarUrl,
  updateCurrentUser,
  uploadUserAvatar,
  changePassword,
} from '../../redux';
import ProfileHeader from './components/ProfileHeader';
import PersonalInfoCard from './components/PersonalInfoCard';
import SecurityCard from './components/SecurityCard';
import s from './Profile.css';

function Profile() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const user = useSelector(getCurrentUser);
  const avatarUrl = useSelector(getCurrentUserAvatarUrl);

  // Profile form state
  const [formData, setFormData] = useState({
    display_name: '',
    first_name: '',
    last_name: '',
    bio: '',
    location: '',
    website: '',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Password change state
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState({
    type: '',
    text: '',
  });

  // Sync form data with user
  useEffect(() => {
    if (user) {
      setFormData({
        display_name: user.display_name || '',
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        bio: user.bio || '',
        location: user.location || '',
        website: user.website || '',
      });
    }
  }, [user]);

  // Handle profile form field change
  const handleFormChange = useCallback((name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  }, []);

  // Handle profile form submit
  const handleProfileSubmit = useCallback(
    async e => {
      e.preventDefault();
      setLoading(true);
      setMessage({ type: '', text: '' });

      const result = await dispatch(updateCurrentUser(formData));

      setLoading(false);
      if (result.success) {
        setMessage({
          type: 'success',
          text: t('profile.updateSuccess', 'Profile updated successfully'),
        });
      } else {
        setMessage({
          type: 'error',
          text:
            result.error ||
            t('profile.updateError', 'Failed to update profile'),
        });
      }
    },
    [dispatch, formData, t],
  );

  // Handle avatar upload
  const handleAvatarUpload = useCallback(
    async file => {
      setLoading(true);
      setMessage({ type: '', text: '' });

      const result = await dispatch(uploadUserAvatar(file));

      setLoading(false);
      if (result.success) {
        setMessage({
          type: 'success',
          text: t('profile.avatarSuccess', 'Avatar updated successfully'),
        });
      } else {
        setMessage({
          type: 'error',
          text:
            result.error || t('profile.avatarError', 'Failed to update avatar'),
        });
      }
    },
    [dispatch, t],
  );

  // Handle password change
  const handlePasswordChange = useCallback(
    async ({ currentPassword, newPassword, confirmPassword }) => {
      setPasswordMessage({ type: '', text: '' });

      // Validation
      if (newPassword.length < 8) {
        setPasswordMessage({
          type: 'error',
          text: t('profile.passwordTooShort'),
        });
        return false;
      }

      if (newPassword !== confirmPassword) {
        setPasswordMessage({
          type: 'error',
          text: t('profile.passwordMismatch'),
        });
        return false;
      }

      setPasswordLoading(true);

      const result = await dispatch(
        changePassword({
          currentPassword,
          newPassword,
        }),
      );

      setPasswordLoading(false);

      if (result.success) {
        setPasswordMessage({
          type: 'success',
          text: t('profile.passwordSuccess'),
        });
        return true;
      }

      setPasswordMessage({
        type: 'error',
        text: result.error || t('profile.passwordError'),
      });
      return false;
    },
    [dispatch, t],
  );

  return (
    <div className={s.root}>
      <div className={s.wrapper}>
        <ProfileHeader
          user={user}
          avatarUrl={avatarUrl}
          displayName={formData.display_name}
          onAvatarUpload={handleAvatarUpload}
          loading={loading}
        />

        <div className={s.cardsGrid}>
          <PersonalInfoCard
            formData={formData}
            onChange={handleFormChange}
            onSubmit={handleProfileSubmit}
            loading={loading}
            message={message}
          />

          <SecurityCard
            user={user}
            onChangePassword={handlePasswordChange}
            loading={passwordLoading}
            message={passwordMessage}
          />
        </div>
      </div>
    </div>
  );
}

export default Profile;
