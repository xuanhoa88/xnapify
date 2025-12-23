/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useCallback, useState } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { resetPassword } from '../../redux';
import { Link } from '../../components/History';
import s from './ResetPassword.css';

/**
 * Request Reset Password Page Component
 * Standalone full-page form without header/footer
 */
function RequestResetPassword() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(
    async e => {
      e.preventDefault();
      setError('');
      setSuccess(false);
      setLoading(true);

      const result = await dispatch(resetPassword({ email }));

      setLoading(false);

      if (result.success) {
        setSuccess(true);
        setEmail('');
      } else {
        setError(result.error);
      }
    },
    [email, dispatch],
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
          <div className={s.heroIcon}>🔑</div>
          <h1 className={s.heroTitle}>
            {t('resetPassword.title', 'Reset Password')}
          </h1>
          <p className={s.heroSubtitle}>
            {t(
              'resetPassword.subtitle',
              "Enter your email and we'll send you a reset link",
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
                i18nKey='resetPassword.success'
                components={[<strong key='0' />]}
              />
            </div>
          ) : (
            <form method='post' onSubmit={handleSubmit}>
              <div className={s.formGroup}>
                <label className={s.label} htmlFor='email'>
                  {t('resetPassword.email', 'Email Address')}
                </label>
                <input
                  className={s.input}
                  id='email'
                  type='email'
                  name='email'
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder={t(
                    'resetPassword.emailPlaceholder',
                    'your.email@example.com',
                  )}
                  required
                  autoFocus // eslint-disable-line jsx-a11y/no-autofocus
                />
              </div>
              <button
                className={s.submitButton}
                type='submit'
                disabled={loading}
              >
                {loading
                  ? t('resetPassword.loading', 'Sending...')
                  : t('resetPassword.submit', 'Send Reset Link')}
              </button>
            </form>
          )}

          <div className={s.backLink}>
            <Link to='/login' className={s.link}>
              {t('resetPassword.backToLogin', '← Back to Login')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RequestResetPassword;
