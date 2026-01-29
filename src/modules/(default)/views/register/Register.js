/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useCallback, useEffect } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import PropTypes from 'prop-types';
import {
  register,
  isAuthLoading,
  getAuthError,
  clearAuthError,
} from '../../../../shared/renderer/redux';
import {
  Link,
  useHistory,
  useQuery,
} from '../../../../shared/renderer/components/History';
import { useWebSocket } from '../../../../shared/ws/client';
import Button from '../../../../shared/renderer/components/Button';
import Form, {
  useFormContext,
} from '../../../../shared/renderer/components/Form';
import { registerFormSchema } from '../../../users/validator/auth';
import s from './Register.css';

/**
 * Register Page Component
 * Standalone full-page registration without header/footer
 */
function Register() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const history = useHistory();
  const ws = useWebSocket();
  const loading = useSelector(isAuthLoading);
  const error = useSelector(getAuthError);

  const returnTo = useQuery('returnTo') || '/';

  // Clear error on unmount
  useEffect(() => {
    return () => {
      dispatch(clearAuthError());
    };
  }, [dispatch]);

  const handleSubmit = useCallback(
    async data => {
      try {
        const result = await dispatch(
          register({
            email: data.email,
            password: data.password,
            confirmPassword: data.confirmPassword,
          }),
        ).unwrap();

        if (ws && result.accessToken) {
          ws.login(result.accessToken);
        }
        history.replace(returnTo);
      } catch {
        // Error is handled by Redux state
      }
    },
    [dispatch, history, returnTo, ws],
  );

  return (
    <div className={s.root}>
      <HeroSection />

      <div className={s.formSection}>
        <div className={s.formContainer}>
          <h2 className={s.formTitle}>
            {t('navigation.register', 'Register')}
          </h2>

          <Form.Error message={error} />

          <Form
            schema={registerFormSchema}
            defaultValues={{
              email: '',
              password: '',
              confirmPassword: '',
            }}
            onSubmit={handleSubmit}
          >
            <RegisterFormFields loading={loading} />
          </Form>

          <div className={s.loginLink}>
            <Trans
              t={t}
              i18nKey='register.alreadyHaveAccount'
              // eslint-disable-next-line react/jsx-key, jsx-a11y/anchor-has-content
              components={[<Link to='/login' className={s.link} />]}
            />
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
        <h1 className={s.heroTitle}>
          {t('register.welcome', 'Create Account')}
        </h1>
        <p className={s.heroSubtitle}>
          {t('register.heroSubtitle', 'Join us and start your journey')}
        </p>
      </div>
    </div>
  );
}

/**
 * Register Form Fields
 */
function RegisterFormFields({ loading }) {
  const { t } = useTranslation();
  const {
    formState: { isSubmitting },
  } = useFormContext();

  return (
    <>
      <Form.Field name='email' label={t('register.email')}>
        <Form.Input
          type='email'
          placeholder={t('register.emailPlaceholder', 'your.email@example.com')}
        />
      </Form.Field>

      <Form.Field name='password' label={t('register.password')}>
        <Form.Password />
      </Form.Field>

      <Form.Field name='confirmPassword' label={t('register.confirmPassword')}>
        <Form.Password />
      </Form.Field>

      <Button
        variant='primary'
        type='submit'
        fullWidth
        className={s.submitButton}
        loading={loading || isSubmitting}
      >
        {loading ? t('register.loading') : t('register.submit')}
      </Button>
    </>
  );
}

RegisterFormFields.propTypes = {
  loading: PropTypes.bool,
};

export default Register;
