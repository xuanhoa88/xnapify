/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useCallback, useEffect } from 'react';

import { Flex, Box, Text, Heading, Button } from '@radix-ui/themes';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import { ExtensionSlot } from '@shared/renderer/components/Extension';
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
 * Login Page Component natively mapped to Radix Flex Layouts
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
  const settings = useSelector(state => state.settings || {});
  const isRegistrationAllowed =
    settings && settings['auth.ALLOW_REGISTRATION'] !== false;

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
    <Flex className={s.pageContainer}>
      <HeroSection />

      <Flex align='center' justify='center' className={s.contentWrapper}>
        <Box className={s.formBox}>
          <Heading as='h1' size='7' mb='6' className={s.title}>
            {t('navigation.login', 'Log In')}
          </Heading>

          <Form.Error message={error} />

          {/* OAuth buttons slot — container is always rendered for SSR hydration safety. */}
          <Box mb='5' className={s.descriptionBox}>
            <Box className={s.descriptionEmpty}>
              <ExtensionSlot name='auth.oauth.buttons' />
            </Box>

            <Flex align='center' className={s.divider}>
              <Box className={s.dividerLine} />
              <Box className={s.dividerText}>
                {t('login.orContinueWith', 'Or continue with')}
              </Box>
              <Box className={s.dividerLine} />
            </Flex>
          </Box>

          <Form
            schema={loginFormSchema}
            defaultValues={{ email: '', password: '', rememberMe: false }}
            onSubmit={handleSubmit}
          >
            <LoginFormFields loading={loading} />
            <ExtensionSlot name='auth.login.quickAccess' />
          </Form>

          {isRegistrationAllowed && (
            <Flex justify='center' mt='5'>
              <Box className={s.registerLinkBox}>
                {t('login.noAccount', "Don't have an account?")}{' '}
                <Link to='/register' className={s.registerLink}>
                  {t('login.register', 'Sign up')}
                </Link>
              </Box>
            </Flex>
          )}
        </Box>
      </Flex>
    </Flex>
  );
}

/**
 * Hero Section - Left side branding
 */
function HeroSection() {
  const { t } = useTranslation();

  return (
    <Flex
      direction='column'
      justify='center'
      align='center'
      className={s.heroSection}
    >
      <Flex direction='column' align='center' className={s.heroContent}>
        <Link to='/' className={s.logoLink}>
          <img
            src='/xnapify_38x38.png'
            srcSet='/xnapify_72x72.png 2x'
            width='48'
            height='48'
            alt='xnapify'
            className={s.logoImg}
          />
          <Text size='5' weight='bold'>
            xnapify
          </Text>
        </Link>
        <Heading as='h1' size='8' mb='3' className={s.heroTitle}>
          {t('login.welcome', 'Welcome Back')}
        </Heading>
        <Text size='4' className={s.heroSubtitle}>
          {t('login.heroSubtitle', 'Sign in to continue to your account')}
        </Text>
      </Flex>
    </Flex>
  );
}

/**
 * Login Form Fields
 */
function LoginFormFields({ loading }) {
  const { t } = useTranslation();

  return (
    <Flex direction='column' gap='4'>
      <Form.Field name='email' label={t('login.email', 'Email')}>
        <Form.Input
          type='email'
          placeholder={t('login.emailPlaceholder', 'your.email@example.com')}
        />
      </Form.Field>

      <Form.Field name='password' showError={false}>
        <Flex justify='between' align='end' mb='2'>
          <Form.Label>{t('login.password', 'Password')}</Form.Label>
          <Link to='/reset-password' className={s.formFieldsForgotPasswordLink}>
            {' '}
            {t('login.forgotPassword', 'Forgot password?')}
          </Link>
        </Flex>
        <Form.Password />
        <Form.Error />
      </Form.Field>

      <Form.Field name='rememberMe'>
        <Form.Checkbox label={t('login.rememberMe', 'Remember me')} />
      </Form.Field>

      <Button
        variant='solid'
        color='indigo'
        size='3'
        type='submit'
        mt='2'
        className={s.fullWidthBtn}
        loading={loading}
      >
        {loading
          ? t('login.loading', 'Loading...')
          : t('login.submit', 'Submit')}
      </Button>
    </Flex>
  );
}

LoginFormFields.propTypes = {
  loading: PropTypes.bool,
};

export default Login;
