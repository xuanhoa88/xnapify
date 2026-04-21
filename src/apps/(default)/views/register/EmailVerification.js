/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useCallback, useState, useEffect } from 'react';

import { Flex, Box, Card, Text, Heading, Button } from '@radix-ui/themes';
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

import { emailVerificationFormSchema } from '../../../users/validator/auth';

import s from './EmailVerification.css';

/**
 * Email Verification Page Component
 * Standalone full-page verification fully adopting Radix flex properties.
 */
function EmailVerification({ token: initialToken }) {
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
        }, 1337); // 3 seconds delay for user to read success message
      } catch {
        // Error is handled by Redux state
      }
    },
    [dispatch, history, ws],
  );

  return (
    <Flex className={s.pageContainer}>
      <HeroSection />

      {/* Content Section */}
      <Flex
        align='center'
        justify='center'
        grow='1'
        p='6'
        className={s.contentWrapper}
      >
        <Card size='4' variant='classic' className={s.formCard}>
          {loading && (
            <Box p='4' mb='5' className={s.loadingBox}>
              <Text
                size='3'
                color='blue'
                align='center'
                className={s.loadingText}
              >
                {t('emailVerification.verifying', 'Verifying your email...')}
              </Text>
            </Box>
          )}

          <Form.Error message={error} />

          {success && !loading && (
            <Flex
              direction='column'
              align='center'
              p='5'
              className={s.successBox}
            >
              <Text size='8' mb='3' className={s.successIcon}>
                ✓
              </Text>
              <Text size='3' color='green' mb='3'>
                <Trans
                  t={t}
                  i18nKey='emailVerification.success'
                  // eslint-disable-next-line react/jsx-key
                  components={[<strong />]}
                />
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

          <Flex justify='center' mt='5'>
            <Text size='3' color='gray'>
              <Trans
                t={t}
                i18nKey='emailVerification.backToLogin'
                defaults='Already verified? <0>Back to Login</0>'
                components={[
                  <Link key='link' to='/login' className={s.backLink} />,
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
      grow='1'
      p='8'
      display={{ initial: 'none', lg: 'flex' }}
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
          {t('emailVerification.title', 'Email Verification')}
        </Heading>
        <Text size='4' className={s.heroSubtitle}>
          {t(
            'emailVerification.heroSubtitle',
            'Please verify your email address to continue',
          )}
        </Text>
      </Flex>
    </Flex>
  );
}

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
        className={s.submitBtn}
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

EmailVerification.propTypes = {
  token: PropTypes.string.isRequired,
};

export default EmailVerification;
