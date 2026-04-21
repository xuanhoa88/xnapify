/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useCallback, useEffect } from 'react';

import { Flex, Text, Heading, Button } from '@radix-ui/themes';
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

/**
 * Register Page Component
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
    <>
      <Flex direction='column' align='center' mb='6'>
        <Heading as='h2' size='6' mb='2' weight='bold'>
          {t('register.welcome', 'Create Account')}
        </Heading>
        <Text size='3' color='gray'>
          {t('register.heroSubtitle', 'Join us and start your journey')}
        </Text>
      </Flex>

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

      <Flex
        justify='center'
        mt='5'
        pt='5'
        className='border-t border-[var(--gray-a6)]'
      >
        <Text size='2' color='gray'>
          <Trans
            t={t}
            i18nKey='register.alreadyHaveAccount'
            // eslint-disable-next-line jsx-a11y/anchor-has-content
            components={[
              <Link
                key='login'
                to='/login'
                className='text-[var(--accent-11)] hover:text-[var(--accent-12)] font-medium no-underline'
              />,
            ]}
          />
        </Text>
      </Flex>
    </>
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
        className='w-full cursor-pointer'
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
