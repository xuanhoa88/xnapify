/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useCallback, useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation, Trans } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { resetPasswordConfirmation } from '../../redux';
import { Link } from '../../components/History';
import s from './ResetPassword.css';

/**
 * Reset Password Confirmation Page Component
 * Standalone full-page form without header/footer
 */
function ResetPasswordConfirmation({ token }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(
    async e => {
      e.preventDefault();
      setError('');
      setSuccess(false);

      // Validate passwords match
      if (password && password !== confirmPassword) {
        setError(
          t(
            'resetPasswordConfirmation.passwordMismatch',
            'Passwords do not match',
          ),
        );
        return;
      }

      // Validate password length
      if (password.length < 8) {
        setError(
          t(
            'resetPasswordConfirmation.passwordTooShort',
            'Password must be at least 8 characters',
          ),
        );
        return;
      }

      setLoading(true);

      const result = await dispatch(
        resetPasswordConfirmation({ token, password, confirmPassword }),
      );

      setLoading(false);

      if (result.success) {
        setSuccess(true);
        setPassword('');
        setConfirmPassword('');
      } else {
        setError(result.error);
      }
    },
    [token, password, confirmPassword, dispatch, t],
  );

  return (
    <div className={s.root}>
      {/* Hero Section */}
      <div className={s.hero}>
        <div className={s.heroContent}>
          <Link to='/' className={s.brand}>
            <img
              src='/rsk_38x38.png'
              srcSet='/rsk_72x72.png 2x'
              width='48'
              height='48'
              alt='RSK'
            />
            <span className={s.brandText}>React Starter Kit</span>
          </Link>
          <div className={s.heroIcon}>🔐</div>
          <h1 className={s.heroTitle}>
            {t('resetPasswordConfirmation.title', 'Set New Password')}
          </h1>
          <p className={s.heroSubtitle}>
            {t(
              'resetPasswordConfirmation.subtitle',
              'Create a strong password for your account',
            )}
          </p>
        </div>
      </div>

      {/* Form Section */}
      <div className={s.formSection}>
        <div className={s.formContainer}>
          {error && <div className={s.error}>{error}</div>}

          {success ? (
            <div className={s.successBox}>
              <div className={s.successIcon}>✓</div>
              <Trans
                t={t}
                i18nKey='resetPasswordConfirmation.success'
                components={[<strong key='0' />]}
              />
              <Link to='/login' className={s.submitButton}>
                {t('resetPasswordConfirmation.goToLogin', 'Go to Login')}
              </Link>
            </div>
          ) : (
            <form method='post' onSubmit={handleSubmit}>
              <div className={s.formGroup}>
                <label className={s.label} htmlFor='password'>
                  {t('resetPasswordConfirmation.newPassword', 'New Password')}
                </label>
                <input
                  className={s.input}
                  id='password'
                  type='password'
                  name='password'
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder='••••••••'
                  required
                  minLength={8}
                  autoFocus // eslint-disable-line jsx-a11y/no-autofocus
                />
              </div>
              <div className={s.formGroup}>
                <label className={s.label} htmlFor='confirmPassword'>
                  {t(
                    'resetPasswordConfirmation.confirmPassword',
                    'Confirm Password',
                  )}
                </label>
                <input
                  className={s.input}
                  id='confirmPassword'
                  type='password'
                  name='confirmPassword'
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder='••••••••'
                  required
                  minLength={8}
                />
              </div>
              <button
                className={s.submitButton}
                type='submit'
                disabled={loading}
              >
                {loading
                  ? t('resetPasswordConfirmation.loading', 'Resetting...')
                  : t('resetPasswordConfirmation.submit', 'Reset Password')}
              </button>
            </form>
          )}

          <div className={s.backLink}>
            <Link to='/login' className={s.link}>
              {t('resetPasswordConfirmation.backToLogin', '← Back to Login')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

ResetPasswordConfirmation.propTypes = {
  token: PropTypes.string.isRequired,
};

export default ResetPasswordConfirmation;
