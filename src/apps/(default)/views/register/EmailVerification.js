/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useCallback, useState, useEffect } from 'react';

import PropTypes from 'prop-types';
import { useTranslation, Trans } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import Button from '@shared/renderer/components/Button';
import Form, { useFormContext } from '@shared/renderer/components/Form';
import { Link, useHistory } from '@shared/renderer/components/History';
import Icon from '@shared/renderer/components/Icon';
import {
  emailVerification,
  isEmailVerificationLoading,
  getEmailVerificationError,
  clearEmailVerificationError,
} from '@shared/renderer/redux';
import { useWebSocket } from '@shared/ws/client';

import { emailVerificationFormSchema } from '../../../users/validator/auth';

import s from './EmailVerification.css';

/**
 * Email Verification Page Component
 * Standalone full-page verification without header/footer
 */
function EmailVerification({ token: initialToken }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const history = useHistory();
  const ws = useWebSocket();
  const loading = useSelector(isEmailVerificationLoading);
  const error = useSelector(getEmailVerificationError);
  const [success, setSuccess] = useState(false);

  // Clear error on unmount
  useEffect(() => {
    return () => {
      dispatch(clearEmailVerificationError());
    };
  }, [dispatch]);

  const handleSubmit = useCallback(
    async data => {
      try {
        const result = await dispatch(
          emailVerification({ token: data.token }),
        ).unwrap();

        setSuccess(true);
        if (ws && result.accessToken) {
          ws.login(result.accessToken);
        }
        // Redirect to home after short delay to show success message
        setTimeout(() => {
          history.replace('/');
        }, 1337); // 3 seconds delay for user to read success message
      } catch {
        // Error is handled by Redux state
      }
    },
    [dispatch, history, ws],
  );

  return (
    <div className={s.root}>
      <HeroSection />

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

          <Form.Error message={error} />

          {success && !loading && (
            <div className={s.successBox}>
              <div className={s.successIcon}>✓</div>
              <Trans
                t={t}
                i18nKey='emailVerification.success'
                // eslint-disable-next-line react/jsx-key
                components={[<strong />]}
              />
              <p className={s.redirectMessage}>
                {t('emailVerification.redirecting', 'Redirecting to home...')}
              </p>
            </div>
          )}

          {!success && !loading && (
            <Form
              schema={emailVerificationFormSchema}
              defaultValues={{ token: initialToken || '' }}
              onSubmit={handleSubmit}
            >
              <EmailVerificationFormFields
                loading={loading}
                showTokenField={!initialToken}
              />
            </Form>
          )}

          <div className={s.backLink}>
            <Link to='/login' className={s.link}>
              <Icon name='arrowLeft' />
              {t('emailVerification.backToLogin', 'Back to Login')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Hero Section
 */
function HeroSection() {
  const { t } = useTranslation();

  return (
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
  );
}

/**
 * Email Verification Form Fields
 */
function EmailVerificationFormFields({ loading, showTokenField }) {
  const { t } = useTranslation();
  const {
    formState: { isSubmitting },
  } = useFormContext();

  return (
    <>
      <p className={s.description}>
        {t(
          'emailVerification.description',
          'Click the button below to verify your email address.',
        )}
      </p>

      {showTokenField && (
        <Form.Field
          name='token'
          label={t('emailVerification.token', 'Verification Token')}
        >
          <Form.Input
            type='text'
            placeholder={t(
              'emailVerification.tokenPlaceholder',
              'Enter your verification token',
            )}
          />
        </Form.Field>
      )}

      <Button
        variant='primary'
        type='submit'
        fullWidth
        className={s.submitButton}
        loading={loading || isSubmitting}
      >
        {loading
          ? t('emailVerification.loading', 'Verifying...')
          : t('emailVerification.submit', 'Verify Email')}
      </Button>
    </>
  );
}

EmailVerificationFormFields.propTypes = {
  loading: PropTypes.bool,
  showTokenField: PropTypes.bool,
};

EmailVerification.propTypes = {
  token: PropTypes.string.isRequired,
};

export default EmailVerification;
