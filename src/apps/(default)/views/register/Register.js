/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useCallback, useEffect } from 'react';

import { Flex, Card, Text, Heading, Button } from '@radix-ui/themes';
import PropTypes from 'prop-types';
import { useTranslation, Trans } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import Form, { useFormContext } from '@shared/renderer/components/Form';
import {
  Link,
  useHistory,
  useQuery,
} from '@shared/renderer/components/History';
import {
  register,
  isAuthLoading,
  getAuthError,
  clearAuthError,
} from '@shared/renderer/redux';
import { useWebSocket } from '@shared/ws/client';

import { registerFormSchema } from '../../../users/validator/auth';

import s from './Register.css';

/**
 * Register Page Component
 * Standalone full-page registration cleanly mapped via Radix Box layouts
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
    <Flex className={s.pageContainer}>
      <HeroSection />

      <Flex align='center' justify='center' className={s.contentWrapper}>
        <Card size='4' variant='classic' className={s.formCard}>
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

          <Flex justify='center' mt='5'>
            <Text size='3' color='gray'>
              <Trans
                t={t}
                i18nKey='register.alreadyHaveAccount'
                // eslint-disable-next-line react/jsx-key, jsx-a11y/anchor-has-content
                components={[
                  <Link key='link' to='/login' className={s.loginLink} />,
                ]}
              />
            </Text>
          </Flex>
        </Card>
      </Flex>
    </Flex>
  );
}

/**
 * Hero Section
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
        <Heading as='h2' size='8' mb='3' className={s.heroTitle}>
          {t('register.welcome', 'Create Account')}
        </Heading>
        <Text size='4' className={s.heroSubtitle}>
          {t('register.heroSubtitle', 'Join us and start your journey')}
        </Text>
      </Flex>
    </Flex>
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
    <Flex direction='column' gap='4'>
      <Form.Field name='email' label={t('register.email', 'Email')}>
        <Form.Input
          type='email'
          placeholder={t('register.emailPlaceholder', 'your.email@example.com')}
        />
      </Form.Field>

      <Form.Field name='password' label={t('register.password', 'Password')}>
        <Form.Password />
      </Form.Field>

      <Form.Field
        name='confirmPassword'
        label={t('register.confirmPassword', 'Confirm Password')}
      >
        <Form.Password />
      </Form.Field>

      <Button
        variant='solid'
        color='indigo'
        size='3'
        type='submit'
        mt='2'
        className={s.fullWidthBtn}
        loading={loading || isSubmitting}
      >
        {loading
          ? t('register.loading', 'Loading...')
          : t('register.submit', 'Register')}
      </Button>
    </Flex>
  );
}

RegisterFormFields.propTypes = {
  loading: PropTypes.bool,
};

export default Register;
