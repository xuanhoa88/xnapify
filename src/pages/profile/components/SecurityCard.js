/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import Icon from '../../../components/Icon';
import Button from '../../../components/Button';
import s from './SecurityCard.css';

function SecurityCard({ onChangePassword, loading, message }) {
  const { t } = useTranslation();

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  const handlePasswordChange = useCallback(e => {
    const { name, value } = e.target;
    setPasswordData(prev => ({ ...prev, [name]: value }));
  }, []);

  const togglePasswordVisibility = useCallback(field => {
    setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));
  }, []);

  const handleSubmit = useCallback(
    async e => {
      e.preventDefault();

      const success = await onChangePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
        confirmPassword: passwordData.confirmPassword,
      });

      if (success) {
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
      }
    },
    [onChangePassword, passwordData],
  );

  return (
    <div className={s.card}>
      <div className={s.cardHeader}>
        <div className={s.cardIcon}>
          <Icon name='lock' size={22} />
        </div>
        <div>
          <h2 className={s.cardTitle}>{t('profile.security', 'Security')}</h2>
          <p className={s.cardDescription}>
            {t('profile.securityDesc', 'Manage your password and security')}
          </p>
        </div>
      </div>

      {message.text && (
        <div className={message.type === 'error' ? s.error : s.success}>
          {message.type === 'success' && <Icon name='check' size={16} />}
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className={s.formGroup}>
          <label className={s.label} htmlFor='currentPassword'>
            {t('profile.currentPassword')}
          </label>
          <div className={s.inputGroup}>
            <input
              className={s.input}
              id='currentPassword'
              name='currentPassword'
              type={showPasswords.current ? 'text' : 'password'}
              value={passwordData.currentPassword}
              onChange={handlePasswordChange}
              required
              placeholder='••••••••'
            />
            <Button
              variant='ghost'
              iconOnly
              className={s.togglePassword}
              onClick={() => togglePasswordVisibility('current')}
              title={showPasswords.current ? 'Hide password' : 'Show password'}
            >
              {showPasswords.current ? (
                <Icon name='eyeOff' size={20} />
              ) : (
                <Icon name='eye' size={20} />
              )}
            </Button>
          </div>
        </div>

        <div className={s.formGroup}>
          <label className={s.label} htmlFor='newPassword'>
            {t('profile.newPassword')}
          </label>
          <div className={s.inputGroup}>
            <input
              className={s.input}
              id='newPassword'
              name='newPassword'
              type={showPasswords.new ? 'text' : 'password'}
              value={passwordData.newPassword}
              onChange={handlePasswordChange}
              required
              minLength={8}
              placeholder='••••••••'
            />
            <Button
              variant='ghost'
              iconOnly
              className={s.togglePassword}
              onClick={() => togglePasswordVisibility('new')}
              title={showPasswords.new ? 'Hide password' : 'Show password'}
            >
              {showPasswords.new ? (
                <Icon name='eyeOff' size={20} />
              ) : (
                <Icon name='eye' size={20} />
              )}
            </Button>
          </div>
        </div>

        <div className={s.formGroup}>
          <label className={s.label} htmlFor='confirmPassword'>
            {t('profile.confirmPassword')}
          </label>
          <div className={s.inputGroup}>
            <input
              className={s.input}
              id='confirmPassword'
              name='confirmPassword'
              type={showPasswords.confirm ? 'text' : 'password'}
              value={passwordData.confirmPassword}
              onChange={handlePasswordChange}
              required
              minLength={8}
              placeholder='••••••••'
            />
            <Button
              variant='ghost'
              iconOnly
              className={s.togglePassword}
              onClick={() => togglePasswordVisibility('confirm')}
              title={showPasswords.confirm ? 'Hide password' : 'Show password'}
            >
              {showPasswords.confirm ? (
                <Icon name='eyeOff' size={20} />
              ) : (
                <Icon name='eye' size={20} />
              )}
            </Button>
          </div>
        </div>

        <Button
          variant='secondary'
          type='submit'
          className={s.buttonSecondary}
          loading={loading}
        >
          {loading
            ? t('profile.changingPassword')
            : t('profile.updatePassword')}
        </Button>
      </form>
    </div>
  );
}

SecurityCard.propTypes = {
  user: PropTypes.shape({
    email: PropTypes.string,
  }),
  onChangePassword: PropTypes.func.isRequired,
  loading: PropTypes.bool,
  message: PropTypes.shape({
    type: PropTypes.string,
    text: PropTypes.string,
  }),
};

export default SecurityCard;
