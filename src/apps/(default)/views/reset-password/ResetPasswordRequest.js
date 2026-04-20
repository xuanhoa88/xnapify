/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useCallback, useState, useEffect } from 'react';


import { Flex, Card, Text, Heading, Button } from '@radix-ui/themes';
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

import s from './ResetPasswordRequest.css';

/**
 * Reset Password Request Page Component
 * Standalone full-page form without header/footer natively mapped to Radix layouts
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
    <Flex className={s.pageContainer}>
      <HeroSection />

      <Flex align='center' justify='center' className={s.contentWrapper}>
        <Card size='4' variant='classic' className={s.formCard}>
          <Form.Error message={error} />

          {success ? (
            <Flex
              direction='column'
              align='center'
              className={s.successBoxRequest}
            >
              <Text size='8' className={s.successIcon}>
                ✓
              </Text>
              <Text size='3' color='green'>
                <Trans
                  t={t}
                  i18nKey='resetPassword.success'
                  // eslint-disable-next-line react/jsx-key
                  components={[<strong />]}
                />
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

          <Flex justify='center' mt='5'>
            <Text size='2' color='gray'>
              <Trans
                t={t}
                i18nKey='resetPassword.backToLogin'
                defaults='Remember your password? <0>Back to Login</0>'
                // eslint-disable-next-line react/jsx-key, jsx-a11y/anchor-has-content
                components={[
                  <Link
                    key='link'
                    to='/login'
                    className={s.backLink}
                  />,
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
          {t('resetPassword.title', 'Reset Password')}
        </Heading>
        <Text size='4' className={s.heroSubtitle}>
          {t(
            'resetPassword.subtitle',
            "Enter your email and we'll send you a reset link",
          )}
        </Text>
      </Flex>
    </Flex>
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
          size='3'
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
        className={s.submitBtn}
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
