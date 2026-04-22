/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useCallback, useState, useEffect } from 'react';

import { CrossCircledIcon, UpdateIcon } from '@radix-ui/react-icons';
import { Flex, Text, Heading } from '@radix-ui/themes';
import PropTypes from 'prop-types';
import { useTranslation, Trans } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import { Link, useHistory } from '@shared/renderer/components/History';
import {
  emailVerification,
  isEmailVerificationLoading,
  getEmailVerificationError,
  clearEmailVerificationError,
} from '@shared/renderer/redux';
import { useWebSocket } from '@shared/ws/client';

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

  const [autoVerifyAttempted, setAutoVerifyAttempted] = useState(false);

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
        // Redirect to login after short delay to show success message
        setTimeout(() => {
          history.replace('/login');
        }, 300);
      } catch {
        // Error is handled by Redux state
      }
    },
    [dispatch, history, ws],
  );

  // Auto-verify if token is provided in URL
  useEffect(() => {
    if (initialToken && !autoVerifyAttempted) {
      setAutoVerifyAttempted(true);
      handleSubmit({ token: initialToken });
    }
  }, [initialToken, autoVerifyAttempted, handleSubmit]);

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
          {t('emailVerification.title', 'Email Verification')}
        </Heading>
        <Text size='3' className='text-slate-500 font-medium'>
          {t(
            'emailVerification.heroSubtitle',
            'Please verify your email address to continue',
          )}
        </Text>
      </Flex>

      {loading || !autoVerifyAttempted ? (
        <Flex
          direction='column'
          align='center'
          p='5'
          mb='5'
          className='bg-indigo-50/50 rounded-xl border border-indigo-100'
        >
          <UpdateIcon className='w-6 h-6 text-indigo-500 animate-spin mb-3' />
          <Text size='3' className='text-indigo-700 font-medium'>
            {t('emailVerification.verifying', 'Verifying your email...')}
          </Text>
        </Flex>
      ) : success ? (
        <Flex
          direction='column'
          align='center'
          p='5'
          className='bg-emerald-50/50 rounded-xl border border-emerald-100'
        >
          <Text size='8' mb='3' className='text-emerald-500'>
            ✓
          </Text>
          <Text size='3' mb='3' className='text-emerald-700 font-semibold'>
            <Trans t={t} i18nKey='emailVerification.success' />
          </Text>
          <Text size='3' className='text-emerald-600/80 font-medium'>
            {t('emailVerification.redirecting', 'Redirecting to login...')}
          </Text>
        </Flex>
      ) : (
        <Flex
          direction='column'
          align='center'
          p='5'
          className='bg-red-50/50 rounded-xl border border-red-100'
        >
          <CrossCircledIcon className='w-8 h-8 text-red-500 mb-3' />
          <Text size='3' className='text-red-700 font-medium text-center'>
            {(error && error.message) ||
              (typeof error === 'string' ? error : null) ||
              t('emailVerification.error', 'Failed to verify email')}
          </Text>
        </Flex>
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
            i18nKey='emailVerification.backToLogin'
            defaults='Already verified? <0>Back to Login</0>'
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

EmailVerification.propTypes = {
  context: PropTypes.shape({
    params: PropTypes.shape({
      token: PropTypes.string,
    }).isRequired,
  }).isRequired,
};

export default EmailVerification;
