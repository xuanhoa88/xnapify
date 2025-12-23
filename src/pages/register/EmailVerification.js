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
import { emailVerification } from '../../redux';
import { Link } from '../../components/History';
import s from './EmailVerification.css';

/**
 * Email Verification Page Component
 * Standalone full-page verification without header/footer
 */
function EmailVerification({ token: initialToken }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const [token, setToken] = useState(initialToken || '');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleVerify = useCallback(
    async tokenToVerify => {
      setError('');
      setSuccess(false);
      setLoading(true);

      const result = await dispatch(
        emailVerification({ token: tokenToVerify }),
      );

      setLoading(false);

      if (result.success) {
        setSuccess(true);
      } else {
        setError(result.error);
      }
    },
    [dispatch],
  );

  const handleSubmit = useCallback(
    async e => {
      e.preventDefault();
      handleVerify(token);
    },
    [token, handleVerify],
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
          <div className={s.heroIcon}>✉️</div>
          <h1 className={s.heroTitle}>
            {t('emailVerification.title', 'Email Verification')}
          </h1>
        </div>
      </div>

      {/* Content Section */}
      <div className={s.formSection}>
        <div className={s.formContainer}>
          {loading && (
            <div className={s.info}>
              <p>
                {t('emailVerification.verifying', 'Verifying your email...')}
              </p>
            </div>
          )}

          {error && !loading && (
            <div className={s.error}>
              <strong>{t('emailVerification.error', 'Error:')}</strong> {error}
            </div>
          )}

          {success && !loading && (
            <div className={s.successBox}>
              <div className={s.successIcon}>✓</div>
              <Trans
                t={t}
                i18nKey='emailVerification.success'
                components={[<strong key='0' />]}
              />
              <Link to='/login' className={s.submitButton}>
                {t('emailVerification.goToLogin', 'Go to Login')}
              </Link>
            </div>
          )}

          {!success && !loading && (
            <form method='post' onSubmit={handleSubmit}>
              <p className={s.description}>
                {t(
                  'emailVerification.description',
                  'Click the button below to verify your email address.',
                )}
              </p>
              {!initialToken && (
                <div className={s.formGroup}>
                  <label className={s.label} htmlFor='token'>
                    {t('emailVerification.token', 'Verification Token')}
                  </label>
                  <input
                    className={s.input}
                    id='token'
                    type='text'
                    name='token'
                    value={token}
                    onChange={e => setToken(e.target.value)}
                    required
                    placeholder={t(
                      'emailVerification.tokenPlaceholder',
                      'Enter your verification token',
                    )}
                  />
                </div>
              )}
              <button
                className={s.submitButton}
                type='submit'
                disabled={loading}
              >
                {loading
                  ? t('emailVerification.loading', 'Verifying...')
                  : t('emailVerification.submit', 'Verify Email')}
              </button>
            </form>
          )}

          <div className={s.backLink}>
            <Link to='/login' className={s.link}>
              {t('emailVerification.backToLogin', '← Back to Login')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

EmailVerification.propTypes = {
  token: PropTypes.string.isRequired,
};

export default EmailVerification;
