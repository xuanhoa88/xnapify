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
  login,
  getUserPreferences,
  setLocale,
  getLocale,
  isAuthLoading,
  getAuthError,
  clearAuthError,
} from '@shared/renderer/redux';
import {
  Link,
  useHistory,
  useQuery,
} from '@shared/renderer/components/History';
import { useWebSocket } from '@shared/ws/client';
import Button from '@shared/renderer/components/Button';
import Form, { useFormContext } from '@shared/renderer/components/Form';
import { loginFormSchema } from '../../../users/validator/auth';
import s from './Login.css';

// Demo users for quick access
const DEMO_USERS = Object.freeze([
  {
    name: 'Admin User',
    email: 'admin@example.com',
    password: 'admin123',
    role: 'Administrator',
  },
  {
    name: 'John Doe',
    email: 'john.doe@example.com',
    password: 'password123',
    role: 'Editor',
  },
  {
    name: 'Jane Smith',
    email: 'jane.smith@example.com',
    password: 'password123',
    role: 'Viewer',
  },
]);

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

          <OAuthButtons />

          <div className={s.divider}>
            <span className={s.dividerLine} />
            <span className={s.dividerText}>{t('login.orDivider', 'OR')}</span>
            <span className={s.dividerLine} />
          </div>

          <Form
            schema={loginFormSchema}
            defaultValues={{ email: '', password: '', rememberMe: false }}
            onSubmit={handleSubmit}
          >
            <LoginFormFields loading={loading} />
            <QuickAccess />
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

/**
 * Quick Access - Demo user selection with auto-submit
 */
function QuickAccess() {
  const { t } = useTranslation();
  const { setValue, handleSubmit } = useFormContext();

  const handleQuickLogin = useCallback(
    user => {
      setValue('email', user.email, { shouldValidate: false });
      setValue('password', user.password, { shouldValidate: false });
      setValue('rememberMe', true, { shouldValidate: false });

      setTimeout(() => {
        handleSubmit(() => {
          const formElement = document.querySelector('form');
          if (formElement) {
            formElement.dispatchEvent(
              new Event('submit', { bubbles: true, cancelable: true }),
            );
          }
        })();
      }, 100);
    },
    [setValue, handleSubmit],
  );

  const handleKeyDown = useCallback(
    event => {
      const { key } = event;
      if (key >= '1' && key <= '3') {
        const userIndex = parseInt(key, 10) - 1;
        if (DEMO_USERS[userIndex]) {
          event.preventDefault();
          handleQuickLogin(DEMO_USERS[userIndex]);
        }
      }
    },
    [handleQuickLogin],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className={s.quickAccess}>
      <h3 className={s.quickAccessTitle}>
        {t('login.quickAccess', 'Quick Access')}
        <span className={s.quickAccessHint}>
          {t('login.quickAccessHint', 'Press 1-3 or click to login')}
        </span>
      </h3>
      <div className={s.userList}>
        {DEMO_USERS.map((user, index) => (
          <Button
            key={user.email}
            variant='ghost'
            className={s.userCard}
            onClick={() => handleQuickLogin(user)}
          >
            <span className={s.userShortcut}>{index + 1}</span>
            <div className={s.userInfo}>
              <span className={s.userName}>{user.name}</span>
              <span className={s.userRole}>{user.role}</span>
            </div>
          </Button>
        ))}
      </div>
    </div>
  );
}

/**
 * OAuth Social Login Buttons
 */
function OAuthButtons() {
  const { t } = useTranslation();

  return (
    <div className={s.oauthButtonsContainer}>
      <a href='/api/auth/oauth/google' className={s.oauthButton}>
        <svg
          viewBox='0 0 24 24'
          width='18'
          height='18'
          xmlns='http://www.w3.org/2000/svg'
        >
          <g transform='matrix(1, 0, 0, 1, 27.009001, -39.238998)'>
            <path
              fill='#4285F4'
              d='M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z'
            />
            <path
              fill='#34A853'
              d='M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z'
            />
            <path
              fill='#FBBC05'
              d='M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z'
            />
            <path
              fill='#EA4335'
              d='M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z'
            />
          </g>
        </svg>
        {t('login.oauthGoogleShort', 'Google')}
      </a>

      <a href='/api/auth/oauth/facebook' className={s.oauthButton}>
        <svg
          viewBox='0 0 24 24'
          width='18'
          height='18'
          fill='#1877F2'
          xmlns='http://www.w3.org/2000/svg'
        >
          <path d='M14 13.5h2.5l1-4H14v-2c0-1.03 0-2 2-2h1.5V2.14c-.326-.043-1.557-.14-2.857-.14C11.928 2 10 3.657 10 6.7v2.8H7v4h3V22h4v-8.5z' />
        </svg>
        {t('login.oauthFacebookShort', 'Facebook')}
      </a>

      <a href='/api/auth/oauth/github' className={s.oauthButton}>
        <svg
          viewBox='0 0 24 24'
          width='18'
          height='18'
          fill='currentColor'
          xmlns='http://www.w3.org/2000/svg'
        >
          <path
            fillRule='evenodd'
            clipRule='evenodd'
            d='M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.164 22 16.418 22 12c0-5.523-4.477-10-10-10z'
          />
        </svg>
        {t('login.oauthGithubShort', 'GitHub')}
      </a>

      <a href='/api/auth/oauth/microsoft' className={s.oauthButton}>
        <svg
          viewBox='0 0 24 24'
          width='18'
          height='18'
          xmlns='http://www.w3.org/2000/svg'
        >
          <path fill='#f35325' d='M1 1h10v10H1z' />
          <path fill='#81bc06' d='M12 1h10v10H12z' />
          <path fill='#05a6f0' d='M1 12h10v10H1z' />
          <path fill='#ffba08' d='M12 12h10v10H12z' />
        </svg>
        {t('login.oauthMicrosoftShort', 'Microsoft')}
      </a>
    </div>
  );
}

export default Login;
