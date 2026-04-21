/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useCallback, useState, useEffect } from 'react';

import { Flex, Text, Heading, Button } from '@radix-ui/themes';
import PropTypes from 'prop-types';
import { useTranslation, Trans } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import Form, { useFormContext } from '@shared/renderer/components/Form';
import { Link } from '@shared/renderer/components/History';
import {
  resetPasswordRequest,
  isResetPasswordLoading,
  getResetPasswordError,
  clearResetPasswordError,
} from '@shared/renderer/redux';

import { passwordResetRequestFormSchema } from '../../../users/validator/auth';

/**
 * Reset Password Request Page Component
 */
function ResetPasswordRequest() {
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
        await dispatch(resetPasswordRequest({ email: data.email })).unwrap();
        setSuccess(true);
      } catch {
        // Error is handled by Redux state
      }
    },
    [dispatch],
  );

  return (
    <>
      <Flex direction='column' align='center' mb='6'>
        <Heading as='h2' size='6' mb='2' weight='bold'>
          {t('resetPassword.title', 'Reset Password')}
        </Heading>
        <Text size='3' color='gray'>
          {t(
            'resetPassword.subtitle',
            "Enter your email and we'll send you a reset link",
          )}
        </Text>
      </Flex>

      <Form.Error message={error} />

      {success ? (
        <Flex
          direction='column'
          align='center'
          p='5'
          className='bg-green-50 rounded-lg border border-green-200'
        >
          <Text size='8' mb='3' className='text-green-600'>
            ✓
          </Text>
          <Text size='3' className='text-green-700'>
            <Trans t={t} i18nKey='resetPassword.success' />
          </Text>
        </Flex>
      ) : (
        <Form
          schema={passwordResetRequestFormSchema}
          defaultValues={{ email: '' }}
          onSubmit={handleSubmit}
        >
          <RequestFormFields loading={loading} />
        </Form>
      )}

      <Flex
        justify='center'
        mt='5'
        pt='5'
        className='border-t border-[var(--gray-a6)]'
      >
        <Text size='2' color='gray'>
          <Trans
            t={t}
            i18nKey='resetPassword.backToLogin'
            defaults='Remember your password? <0>Back to Login</0>'
            components={[
              <Link
                key='link'
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
 * Request Form Fields
 */
function RequestFormFields({ loading }) {
  const { t } = useTranslation();
  const {
    formState: { isSubmitting },
  } = useFormContext();

  return (
    <Flex direction='column' gap='4'>
      <Form.Field
        name='email'
        label={t('resetPassword.email', 'Email Address')}
      >
        <Form.Input
          type='email'
          placeholder={t(
            'resetPassword.emailPlaceholder',
            'your.email@example.com',
          )}
        />
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
          ? t('resetPassword.loading', 'Sending...')
          : t('resetPassword.submit', 'Send Reset Link')}
      </Button>
    </Flex>
  );
}

RequestFormFields.propTypes = {
  loading: PropTypes.bool,
};

export default ResetPasswordRequest;
