/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import { UserIcon, CheckIcon } from './Icons';
import s from './PersonalInfoCard.css';

function PersonalInfoCard({ formData, onChange, onSubmit, loading, message }) {
  const { t } = useTranslation();

  const handleChange = useCallback(
    e => {
      const { name, value } = e.target;
      onChange(name, value);
    },
    [onChange],
  );

  return (
    <div className={s.card}>
      <div className={s.cardHeader}>
        <div className={s.cardIcon}>
          <UserIcon />
        </div>
        <div>
          <h2 className={s.cardTitle}>
            {t('profile.personalInfo', 'Personal Information')}
          </h2>
          <p className={s.cardDescription}>
            {t('profile.personalInfoDesc', 'Update your personal details')}
          </p>
        </div>
      </div>

      {message.text && (
        <div className={message.type === 'error' ? s.error : s.success}>
          {message.type === 'success' && <CheckIcon />}
          {message.text}
        </div>
      )}

      <form onSubmit={onSubmit}>
        <div className={s.formGroup}>
          <label className={s.label} htmlFor='display_name'>
            {t('profile.displayName')}
          </label>
          <input
            className={s.input}
            id='display_name'
            name='display_name'
            type='text'
            value={formData.display_name}
            onChange={handleChange}
            placeholder={t(
              'profile.displayNamePlaceholder',
              'Enter your display name',
            )}
          />
        </div>

        <div className={s.row}>
          <div className={s.col}>
            <div className={s.formGroup}>
              <label className={s.label} htmlFor='first_name'>
                {t('profile.firstName')}
              </label>
              <input
                className={s.input}
                id='first_name'
                name='first_name'
                type='text'
                value={formData.first_name}
                onChange={handleChange}
                placeholder={t('profile.firstNamePlaceholder', 'First name')}
              />
            </div>
          </div>
          <div className={s.col}>
            <div className={s.formGroup}>
              <label className={s.label} htmlFor='last_name'>
                {t('profile.lastName')}
              </label>
              <input
                className={s.input}
                id='last_name'
                name='last_name'
                type='text'
                value={formData.last_name}
                onChange={handleChange}
                placeholder={t('profile.lastNamePlaceholder', 'Last name')}
              />
            </div>
          </div>
        </div>

        <div className={s.formGroup}>
          <label className={s.label} htmlFor='bio'>
            {t('profile.bio')}
          </label>
          <textarea
            className={s.textarea}
            id='bio'
            name='bio'
            rows='3'
            value={formData.bio}
            onChange={handleChange}
            placeholder={t(
              'profile.bioPlaceholder',
              'Tell us about yourself...',
            )}
          />
        </div>

        <div className={s.formGroup}>
          <label className={s.label} htmlFor='location'>
            {t('profile.location')}
          </label>
          <input
            className={s.input}
            id='location'
            name='location'
            type='text'
            value={formData.location}
            onChange={handleChange}
            placeholder={t('profile.locationPlaceholder', 'Your location')}
          />
        </div>

        <div className={s.formGroup}>
          <label className={s.label} htmlFor='website'>
            {t('profile.website')}
          </label>
          <input
            className={s.input}
            id='website'
            name='website'
            type='url'
            value={formData.website}
            onChange={handleChange}
            placeholder={t(
              'profile.websitePlaceholder',
              'https://yourwebsite.com',
            )}
          />
        </div>

        <button className={s.button} type='submit' disabled={loading}>
          {loading && <span className={s.spinner} />}
          {loading ? t('profile.saving') : t('profile.saveChanges')}
        </button>
      </form>
    </div>
  );
}

PersonalInfoCard.propTypes = {
  formData: PropTypes.shape({
    display_name: PropTypes.string,
    first_name: PropTypes.string,
    last_name: PropTypes.string,
    bio: PropTypes.string,
    location: PropTypes.string,
    website: PropTypes.string,
  }).isRequired,
  onChange: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  loading: PropTypes.bool,
  message: PropTypes.shape({
    type: PropTypes.string,
    text: PropTypes.string,
  }),
};

export default PersonalInfoCard;
