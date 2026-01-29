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
      <Form.Field name='email' label={t('login.email')}>
        <Form.Input
          type='email'
          placeholder={t('login.emailPlaceholder', 'your.email@example.com')}
        />
      </Form.Field>

      <Form.Field name='password' showError={false}>
        <div className={s.labelRow}>
          <Form.Label>{t('login.password')}</Form.Label>
          <Link to='/reset-password' className={s.forgotLink}>
            {t('login.forgotPassword')}
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
        {loading ? t('login.loading') : t('login.submit')}
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

export default Login;
