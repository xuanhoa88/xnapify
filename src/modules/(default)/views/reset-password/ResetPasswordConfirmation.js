/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useCallback, useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { useTranslation, Trans } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import {
  resetPasswordConfirmation,
  isResetPasswordLoading,
  getResetPasswordError,
  clearResetPasswordError,
  generatePassword,
  showSuccessMessage,
  getFlashMessage,
  clearFlashMessage,
} from '../../../../shared/renderer/redux';
import Toast from '../../../../shared/renderer/components/Toast';
import Icon from '../../../../shared/renderer/components/Icon';
import { Link } from '../../../../shared/renderer/components/History';
import Button from '../../../../shared/renderer/components/Button';
import Form, {
  useFormContext,
} from '../../../../shared/renderer/components/Form';
import { passwordResetConfirmFormSchema } from '../../../users/validator/auth';
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
  const flashMessage = useSelector(getFlashMessage);
  const [success, setSuccess] = useState(false);
  const toastRef = useRef(null);

  // Handle flash messages
  useEffect(() => {
    if (flashMessage && toastRef.current) {
      toastRef.current.show({
        variant: flashMessage.variant || 'info',
        message: flashMessage.message,
        title: flashMessage.title,
        duration: flashMessage.duration || 4000,
      });
      dispatch(clearFlashMessage());
    }
  }, [flashMessage, dispatch]);

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
              <ResetFormFields loading={loading} dispatch={dispatch} />
            </Form>
          )}

          <div className={s.backLink}>
            <Link to='/login' className={s.link}>
              {t('resetPasswordConfirmation.backToLogin', '← Back to Login')}
            </Link>
          </div>
        </div>
      </div>
      <Toast ref={toastRef} />
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
function ResetFormFields({ loading, dispatch }) {
  const { t } = useTranslation();
  const {
    setValue,
    formState: { isSubmitting },
  } = useFormContext();

  // Password generation state
  const [generatingPassword, setGeneratingPassword] = useState(false);

  const handleGeneratePassword = useCallback(async () => {
    setGeneratingPassword(true);
    try {
      const password = await dispatch(generatePassword()).unwrap();
      setValue('password', password, { shouldValidate: true });
      setValue('confirmPassword', password, { shouldValidate: true });
      dispatch(
        showSuccessMessage({
          message: t(
            'resetPasswordConfirmation.passwordGenerated',
            'Password generated successfully!',
          ),
        }),
      );
    } catch {
      // Error handled silently
    } finally {
      setGeneratingPassword(false);
    }
  }, [dispatch, setValue, t]);

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

      <div className={s.generatePasswordLink}>
        <Button
          variant='unstyled'
          size='small'
          onClick={handleGeneratePassword}
          disabled={generatingPassword}
          className={s.generateBtn}
        >
          {generatingPassword ? (
            t('resetPasswordConfirmation.generatingPassword', 'Generating...')
          ) : (
            <>
              <Icon name='key' size={14} />
              {t(
                'resetPasswordConfirmation.generatePassword',
                'Generate Secure Password',
              )}
            </>
          )}
        </Button>
      </div>

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
  dispatch: PropTypes.func.isRequired,
};

export default ResetPasswordConfirmation;
