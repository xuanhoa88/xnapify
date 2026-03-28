/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useCallback, useEffect } from 'react';

import PropTypes from 'prop-types';
import { useTranslation, Trans } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import ExtensionSlot from '@shared/extension/client/ExtensionSlot';
import Button from '@shared/renderer/components/Button';
import Form from '@shared/renderer/components/Form';
import {
  Link,
  useHistory,
  useQuery,
} from '@shared/renderer/components/History';
import {
  login,
  getUserPreferences,
  setLocale,
  getLocale,
  isAuthLoading,
  getAuthError,
  clearAuthError,
} from '@shared/renderer/redux';
import { useWebSocket } from '@shared/ws/client';

import { loginFormSchema } from '../../../users/validator/auth';

import s from './Login.css';

/**
 * Login Page Component
 */
function Login() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const history = useHistory();
  const ws = useWebSocket();
  const loading = useSelector(isAuthLoading);
  const error = useSelector(getAuthError);
  const currentLocale = useSelector(getLocale);
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
          login({
            email: data.email,
            password: data.password,
            rememberMe: data.rememberMe || false,
          }),
        ).unwrap();

        if (ws && result.accessToken) {
          ws.login(result.accessToken);
        }

        // Fetch user preferences and set locale
        try {
          const prefsResult = await dispatch(getUserPreferences()).unwrap();
          if (
            prefsResult.preferences &&
            prefsResult.preferences.language &&
            prefsResult.preferences.language !== currentLocale
          ) {
            dispatch(setLocale(prefsResult.preferences.language));
          }
        } catch {
          // Ignore preferences fetch error
        }

        history.replace(returnTo);
      } catch {
        // Error is handled by Redux state
      }
    },
    [dispatch, history, returnTo, ws, currentLocale],
  );

  return (
    <div className={s.root}>
      <HeroSection />

      <div className={s.formSection}>
        <div className={s.formContainer}>
          <h2 className={s.formTitle}>{t('navigation.login', 'Log In')}</h2>

          <Form.Error message={error} />

          {/* OAuth buttons slot — container is always rendered for SSR hydration safety.
             CSS hides the wrapper when the slot is empty (no children). */}
          <div className={s.oauthSection}>
            <div className={s.oauthButtonsContainer}>
              <ExtensionSlot
                name='auth.oauth.buttons'
                className={s.oauthButton}
              />
            </div>

            <div className={s.divider}>
              <span className={s.dividerLine} />
              <span className={s.dividerText}>
                {t('login.orDivider', 'OR')}
              </span>
              <span className={s.dividerLine} />
            </div>
          </div>

          <Form
            schema={loginFormSchema}
            defaultValues={{ email: '', password: '', rememberMe: false }}
            onSubmit={handleSubmit}
          >
            <LoginFormFields loading={loading} />
            <ExtensionSlot name='auth.login.quickAccess' />
          </Form>

          <div className={s.registerLink}>
            <Trans
              t={t}
              i18nKey='login.dontHaveAccount'
              // eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key
              components={[<Link to='/register' className={s.link} />]}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Hero Section - Left side branding
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
        <h1 className={s.heroTitle}>{t('login.welcome', 'Welcome Back')}</h1>
        <p className={s.heroSubtitle}>
          {t('login.heroSubtitle', 'Sign in to continue to your account')}
        </p>
      </div>
    </div>
  );
}

/**
 * Login Form Fields
 */
function LoginFormFields({ loading }) {
  const { t } = useTranslation();

  return (
    <>
      <Form.Field name='email' label={t('login.email', 'Email')}>
        <Form.Input
          type='email'
          placeholder={t('login.emailPlaceholder', 'your.email@example.com')}
        />
      </Form.Field>

      <Form.Field name='password' showError={false}>
        <div className={s.labelRow}>
          <Form.Label>{t('login.password', 'Password')}</Form.Label>
          <Link to='/reset-password' className={s.forgotLink}>
            {t('login.forgotPassword', 'Forgot password?')}
          </Link>
        </div>
        <Form.Password />
        <Form.Error />
      </Form.Field>

      <Form.Field name='rememberMe'>
        <Form.Checkbox label={t('login.rememberMe', 'Remember me')} />
      </Form.Field>

      <Button
        variant='primary'
        type='submit'
        fullWidth
        className={s.submitButton}
        loading={loading}
      >
        {loading
          ? t('login.loading', 'Loading...')
          : t('login.submit', 'Submit')}
      </Button>
    </>
  );
}

LoginFormFields.propTypes = {
  loading: PropTypes.bool,
};

export default Login;
