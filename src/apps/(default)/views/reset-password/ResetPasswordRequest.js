/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useCallback, useState, useEffect } from 'react';

import { CrossCircledIcon } from '@radix-ui/react-icons';
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
      <Flex direction='column' align='center' mb='7'>
        <Heading
          as='h2'
          size='7'
          mb='2'
          weight='bold'
          className='text-slate-900 tracking-tight'
        >
          {t('resetPassword.title', 'Reset Password')}
        </Heading>
        <Text size='3' className='text-slate-500 font-medium'>
          {t(
            'resetPassword.subtitle',
            "Enter your email and we'll send you a reset link",
          )}
        </Text>
      </Flex>

      {success ? (
        <Flex
          direction='column'
          align='center'
          p='5'
          className='bg-emerald-50/50 rounded-xl border border-emerald-100'
        >
          <Text size='8' mb='3' className='text-emerald-500'>
            ✓
          </Text>
          <Text size='3' className='text-emerald-700 font-semibold'>
            <Trans t={t} i18nKey='resetPassword.success' />
          </Text>
        </Flex>
      ) : (
        <>
          {error && (
            <Flex
              direction='column'
              align='center'
              p='5'
              mb='5'
              className='bg-red-50/50 rounded-xl border border-red-100'
            >
              <CrossCircledIcon className='w-8 h-8 text-red-500 mb-3' />
              <Text size='3' className='text-red-700 font-medium text-center'>
                {(error && error.message) ||
                  (typeof error === 'string' ? error : null) ||
                  t('resetPassword.error', 'Failed to request password reset')}
              </Text>
            </Flex>
          )}
          <Form
            schema={passwordResetRequestFormSchema}
            defaultValues={{ email: '' }}
            onSubmit={handleSubmit}
          >
            <RequestFormFields loading={loading} />
          </Form>
        </>
      )}

      <Flex
        justify='center'
        mt='6'
        pt='6'
        className='border-t border-slate-200/80'
      >
        <Text size='2' className='text-slate-500'>
          <Trans
            t={t}
            i18nKey='resetPassword.backToLogin'
            defaults='Remember your password? <0>Back to Login</0>'
            components={[
              <Link
                key='link'
                to='/login'
                className='text-indigo-600 hover:text-indigo-700 font-medium no-underline transition-colors duration-200'
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
        mt='3'
        className='w-full cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md'
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
