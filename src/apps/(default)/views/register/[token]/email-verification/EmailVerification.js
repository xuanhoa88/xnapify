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
import { Link, useHistory } from '@shared/renderer/components/History';
import {
  emailVerification,
  isEmailVerificationLoading,
  getEmailVerificationError,
  clearEmailVerificationError,
} from '@shared/renderer/redux';
import { useWebSocket } from '@shared/ws/client';

import { emailVerificationFormSchema } from '../../../../../users/validator/auth';

/**
 * Email Verification Page Component
 */
function EmailVerification({ context: { params } }) {
  const { token: initialToken } = params;
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const history = useHistory();
  const ws = useWebSocket();
  const loading = useSelector(isEmailVerificationLoading);
  const error = useSelector(getEmailVerificationError);
  const [success, setSuccess] = useState(false);

  // Clear error on unmount
  useEffect(() => {
    return () => {
      dispatch(clearEmailVerificationError());
    };
  }, [dispatch]);

  const handleSubmit = useCallback(
    async data => {
      try {
        const result = await dispatch(
          emailVerification({ token: data.token }),
        ).unwrap();

        setSuccess(true);
        if (ws && result.accessToken) {
          ws.login(result.accessToken);
        }
        // Redirect to home after short delay to show success message
        setTimeout(() => {
          history.replace('/');
        }, 1337);
      } catch {
        // Error is handled by Redux state
      }
    },
    [dispatch, history, ws],
  );

  return (
    <>
      <Flex direction='column' align='center' mb='6'>
        <Heading as='h2' size='6' mb='2' weight='bold'>
          {t('emailVerification.title', 'Email Verification')}
        </Heading>
        <Text size='3' color='gray'>
          {t(
            'emailVerification.heroSubtitle',
            'Please verify your email address to continue',
          )}
        </Text>
      </Flex>

      {loading && (
        <Flex
          align='center'
          justify='center'
          p='4'
          mb='5'
          className='bg-blue-50 rounded-lg border border-blue-200'
        >
          <Text size='3' className='text-blue-700'>
            {t('emailVerification.verifying', 'Verifying your email...')}
          </Text>
        </Flex>
      )}

      <Form.Error message={error} />

      {success && !loading && (
        <Flex
          direction='column'
          align='center'
          p='5'
          className='bg-green-50 rounded-lg border border-green-200'
        >
          <Text size='8' mb='3' className='text-green-600'>
            ✓
          </Text>
          <Text size='3' mb='3' className='text-green-700'>
            <Trans t={t} i18nKey='emailVerification.success' />
          </Text>
          <Text size='3' color='gray'>
            {t('emailVerification.redirecting', 'Redirecting to home...')}
          </Text>
        </Flex>
      )}

      {!success && !loading && (
        <Form
          schema={emailVerificationFormSchema}
          defaultValues={{ token: initialToken || '' }}
          onSubmit={handleSubmit}
        >
          <EmailVerificationFormFields
            loading={loading}
            showTokenField={!initialToken}
          />
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
            i18nKey='emailVerification.backToLogin'
            defaults='Already verified? <0>Back to Login</0>'
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

EmailVerification.propTypes = {
  context: PropTypes.shape({
    params: PropTypes.shape({
      token: PropTypes.string.isRequired,
    }).isRequired,
  }).isRequired,
};

/**
 * Email Verification Form Fields
 */
function EmailVerificationFormFields({ loading, showTokenField }) {
  const { t } = useTranslation();
  const {
    formState: { isSubmitting },
  } = useFormContext();

  return (
    <Flex direction='column' gap='4'>
      <Text size='3' color='gray' align='center' mb='4'>
        {t(
          'emailVerification.description',
          'Click the button below to verify your email address.',
        )}
      </Text>

      {showTokenField && (
        <Form.Field
          name='token'
          label={t('emailVerification.token', 'Verification Token')}
        >
          <Form.Input
            type='text'
            placeholder={t(
              'emailVerification.tokenPlaceholder',
              'Enter your verification token',
            )}
          />
        </Form.Field>
      )}

      <Button
        variant='solid'
        color='indigo'
        size='3'
        type='submit'
        className='w-full cursor-pointer'
        loading={loading || isSubmitting}
      >
        {loading
          ? t('emailVerification.loading', 'Verifying...')
          : t('emailVerification.submit', 'Verify Email')}
      </Button>
    </Flex>
  );
}

EmailVerificationFormFields.propTypes = {
  loading: PropTypes.bool,
  showTokenField: PropTypes.bool,
};

export default EmailVerification;
