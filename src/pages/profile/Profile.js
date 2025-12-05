/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useSelector, useDispatch } from 'react-redux';
import { getCurrentUser, updateCurrentUser } from '../../redux';
import s from './Profile.css';

function Profile({ title }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const user = useSelector(getCurrentUser);

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

  const handleChange = useCallback(e => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleSubmit = useCallback(
    async e => {
      e.preventDefault();
      setLoading(true);
      setMessage({ type: '', text: '' });

      const result = await dispatch(updateCurrentUser(formData));

      setLoading(false);
      if (result.success) {
        setMessage({ type: 'success', text: 'Profile updated successfully' });
      } else {
        setMessage({
          type: 'error',
          text: result.error || 'Failed to update profile',
        });
      }
    },
    [dispatch, formData],
  );

  // Get first letter of display name for avatar
  const avatarInitial = useMemo(() => {
    return formData.display_name
      ? formData.display_name.charAt(0).toUpperCase()
      : 'U';
  }, [formData.display_name]);

  return (
    <div className={s.root}>
      <div className={s.container}>
        <h1>{title}</h1>

        <div className={s.avatarContainer}>
          <div className={s.avatar}>{avatarInitial}</div>
        </div>

        {message.text && (
          <div className={message.type === 'error' ? s.error : s.success}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className={s.formGroup}>
            <label className={s.label} htmlFor='display_name'>
              {t('profile.displayName')}
              <input
                className={s.input}
                id='display_name'
                name='display_name'
                type='text'
                value={formData.display_name}
                onChange={handleChange}
              />
            </label>
          </div>

          <div className={s.row}>
            <div className={s.col}>
              <div className={s.formGroup}>
                <label className={s.label} htmlFor='first_name'>
                  {t('profile.firstName')}
                  <input
                    className={s.input}
                    id='first_name'
                    name='first_name'
                    type='text'
                    value={formData.first_name}
                    onChange={handleChange}
                  />
                </label>
              </div>
            </div>
            <div className={s.col}>
              <div className={s.formGroup}>
                <label className={s.label} htmlFor='last_name'>
                  {t('profile.lastName')}
                  <input
                    className={s.input}
                    id='last_name'
                    name='last_name'
                    type='text'
                    value={formData.last_name}
                    onChange={handleChange}
                  />
                </label>
              </div>
            </div>
          </div>

          <div className={s.formGroup}>
            <label className={s.label} htmlFor='bio'>
              {t('profile.bio')}
              <textarea
                className={s.textarea}
                id='bio'
                name='bio'
                rows='3'
                value={formData.bio}
                onChange={handleChange}
              />
            </label>
          </div>

          <div className={s.formGroup}>
            <label className={s.label} htmlFor='location'>
              {t('profile.location')}
              <input
                className={s.input}
                id='location'
                name='location'
                type='text'
                value={formData.location}
                onChange={handleChange}
              />
            </label>
          </div>

          <div className={s.formGroup}>
            <label className={s.label} htmlFor='website'>
              {t('profile.website')}
              <input
                className={s.input}
                id='website'
                name='website'
                type='url'
                value={formData.website}
                onChange={handleChange}
              />
            </label>
          </div>

          <div className={s.formGroup}>
            <label className={s.label} htmlFor='email'>
              {t('profile.email')}
              <input
                className={s.input}
                id='email'
                type='email'
                value={(user && user.email) || ''}
                readOnly
                disabled
              />
            </label>
          </div>

          <div className={s.formGroup}>
            <button className={s.button} type='submit' disabled={loading}>
              {loading ? t('profile.saving') : t('profile.saveChanges')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

Profile.propTypes = {
  title: PropTypes.string.isRequired,
};

export default Profile;
