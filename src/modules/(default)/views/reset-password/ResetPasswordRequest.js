/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useCallback, useState, useEffect } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import PropTypes from 'prop-types';
import {
  resetPasswordRequest,
  isResetPasswordLoading,
  getResetPasswordError,
  clearResetPasswordError,
} from '../../../../shared/renderer/redux';
import { Link } from '../../../../shared/renderer/components/History';
import Button from '../../../../shared/renderer/components/Button';
import Form, {
  useFormContext,
} from '../../../../shared/renderer/components/Form';
import { passwordResetRequestFormSchema } from '../../../users/validator/auth';
import s from './ResetPasswordRequest.css';

/**
 * Reset Password Request Page Component
 * Standalone full-page form without header/footer
 */
function ResetPasswordRequest() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const loading = useSelector(isResetPasswordLoading);
  const error = useSelector(getResetPasswordError);
  const [success, setSuccess] = useState(false);

  // Clear error on unmount
  useEffect(() => {
    return () => {
      dispatch(clearResetPasswordError());
    };
  }, [dispatch]);

  const handleSubmit = useCallback(
    async data => {
      try {
        await dispatch(resetPasswordRequest({ email: data.email })).unwrap();
        setSuccess(true);
      } catch {
        // Error is handled by Redux state
      }
    },
    [dispatch],
  );

  return (
    <div className={s.root}>
      <HeroSection />

      <div className={s.formSection}>
        <div className={s.formContainer}>
          <Form.Error message={error} />

          {success ? (
            <div className={s.successBox}>
              <div className={s.successIcon}>✓</div>
              <Trans
                t={t}
                i18nKey='resetPassword.success'
                // eslint-disable-next-line react/jsx-key
                components={[<strong />]}
              />
            </div>
          ) : (
            <Form
              schema={passwordResetRequestFormSchema}
              defaultValues={{ email: '' }}
              onSubmit={handleSubmit}
            >
              <RequestFormFields loading={loading} />
            </Form>
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
  );
}

/**
 * Request Form Fields
 */
function RequestFormFields({ loading }) {
  const { t } = useTranslation();
  const {
    formState: { isSubmitting },
  } = useFormContext();

  return (
    <>
      <Form.Field
        name='email'
        label={t('resetPassword.email', 'Email Address')}
      >
        <Form.Input
          type='email'
          placeholder={t(
            'resetPassword.emailPlaceholder',
            'your.email@example.com',
          )}
        />
      </Form.Field>

      <Button
        variant='primary'
        type='submit'
        fullWidth
        className={s.submitButton}
        loading={loading || isSubmitting}
      >
        {loading
          ? t('resetPassword.loading', 'Sending...')
          : t('resetPassword.submit', 'Send Reset Link')}
      </Button>
    </>
  );
}

RequestFormFields.propTypes = {
  loading: PropTypes.bool,
};

export default ResetPasswordRequest;
