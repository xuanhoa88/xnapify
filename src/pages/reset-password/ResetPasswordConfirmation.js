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
import { passwordResetConfirmFormSchema } from '../../shared/validator/features/auth';
import {
  resetPasswordConfirmation,
  isResetPasswordLoading,
  getResetPasswordError,
  clearResetPasswordError,
} from '../../redux';
import { Link } from '../../components/History';
import Button from '../../components/Button';
import Form, { useFormContext } from '../../components/Form';
import s from './ResetPasswordConfirmation.css';

/**
 * Reset Password Confirmation Page Component
 * Standalone full-page form without header/footer
 */
function ResetPasswordConfirmation({ token }) {
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
        await dispatch(
          resetPasswordConfirmation({
            token,
            password: data.password,
            confirmPassword: data.confirmPassword,
          }),
        ).unwrap();
        setSuccess(true);
      } catch {
        // Error is handled by Redux state
      }
    },
    [token, dispatch],
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
                i18nKey='resetPasswordConfirmation.success'
                // eslint-disable-next-line react/jsx-key
                components={[<strong />]}
              />
              <Link to='/login' className={s.submitButton}>
                {t('resetPasswordConfirmation.goToLogin', 'Go to Login')}
              </Link>
            </div>
          ) : (
            <Form
              schema={passwordResetConfirmFormSchema}
              defaultValues={{
                token,
                password: '',
                confirmPassword: '',
              }}
              onSubmit={handleSubmit}
            >
              <ResetFormFields loading={loading} />
            </Form>
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
  );
}

/**
 * Reset Form Fields
 */
function ResetFormFields({ loading }) {
  const { t } = useTranslation();
  const {
    formState: { isSubmitting },
  } = useFormContext();

  return (
    <>
      <Form.Field
        name='password'
        label={t('resetPasswordConfirmation.newPassword', 'New Password')}
      >
        <Form.Password />
      </Form.Field>

      <Form.Field
        name='confirmPassword'
        label={t(
          'resetPasswordConfirmation.confirmNewPassword',
          'Confirm New Password',
        )}
      >
        <Form.Password />
      </Form.Field>

      <Button
        variant='primary'
        type='submit'
        fullWidth
        className={s.submitButton}
        loading={loading || isSubmitting}
      >
        {loading
          ? t('resetPasswordConfirmation.loading', 'Resetting...')
          : t('resetPasswordConfirmation.submit', 'Reset Password')}
      </Button>
    </>
  );
}

ResetFormFields.propTypes = {
  loading: PropTypes.bool,
};

export default ResetPasswordConfirmation;
