/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useCallback, useEffect } from 'react';

import { Flex, Text, Heading, Button, Box } from '@radix-ui/themes';
import PropTypes from 'prop-types';
import { Trans, useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import { ExtensionSlot } from '@shared/renderer/components/Extension';
import Form from '@shared/renderer/components/Form';
import {
  Link,
  useHistory,
  useQuery,
} from '@shared/renderer/components/History';
import { features } from '@shared/renderer/redux';
import { useWebSocket } from '@shared/ws/client';

import { loginFormSchema } from '../../../users/validator/auth';

import s from './Login.css';

const {
  login,
  getUserPreferences,
  setLocale,
  getLocale,
  isAuthLoading,
  getAuthError,
  clearAuthError,
  selectSetting,
} = features;

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
  const allowRegistration = useSelector(state =>
    selectSetting(state, 'auth.ALLOW_REGISTRATION'),
  );
  const isRegistrationAllowed = allowRegistration !== false;

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
    <>
      <Flex direction='column' align='center' mb='7'>
        <Heading
          as='h2'
          size='7'
          mb='2'
          weight='bold'
          className='text-slate-900 tracking-tight'
        >
          {t('login.welcome', 'Welcome Back')}
        </Heading>
        <Text size='3' className='text-slate-500 font-medium'>
          {t('login.heroSubtitle', 'Sign in to continue to your account')}
        </Text>
      </Flex>

      <Form.Error message={error} />

      {/* OAuth buttons slot — hidden when no plugins registered */}
      <Box className={s.oauthSection}>
        <Flex wrap='wrap' gap='3' mb='6'>
          <ExtensionSlot name='auth.oauth.buttons' />
        </Flex>

        <Flex align='center' mb='6' className='opacity-60'>
          <Box className='flex-1 h-px bg-[var(--gray-a6)]' />
          <Text
            size='1'
            mx='3'
            color='gray'
            weight='medium'
            className='uppercase tracking-wider'
          >
            {t('login.orDivider', 'OR')}
          </Text>
          <Box className='flex-1 h-px bg-[var(--gray-a6)]' />
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
        <Flex
          justify='center'
          mt='6'
          pt='6'
          className='border-t border-slate-200/80'
        >
          <Text size='2' className='text-slate-500'>
            <Trans
              t={t}
              i18nKey='login.dontHaveAccount'
              // eslint-disable-next-line jsx-a11y/anchor-has-content
              components={[
                <Link
                  key='register'
                  to='/register'
                  className='text-indigo-600 hover:text-indigo-700 font-medium no-underline transition-colors duration-200'
                />,
              ]}
            />
          </Text>
        </Flex>
      )}
    </>
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
        <Flex justify='between' align='baseline'>
          <Form.Label>{t('login.password', 'Password')}</Form.Label>
          <Link
            to='/reset-password'
            className='text-xs text-indigo-600 hover:text-indigo-700 no-underline font-medium transition-colors duration-200'
          >
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
        mt='3'
        className='w-full cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md'
        loading={loading}
      >
        {loading
          ? t('login.loading', 'Loading...')
          : t('login.submit', 'Log in')}
      </Button>
    </Flex>
  );
}

LoginFormFields.propTypes = {
  loading: PropTypes.bool,
};

export default Login;
