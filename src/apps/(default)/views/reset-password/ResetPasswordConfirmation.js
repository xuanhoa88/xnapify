/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useCallback, useState, useEffect, useRef } from 'react';

import { LockOpen1Icon } from '@radix-ui/react-icons';
import { Flex, Card, Text, Heading, Button } from '@radix-ui/themes';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import { useTranslation, Trans } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import Form, { useFormContext } from '@shared/renderer/components/Form';
import { Link } from '@shared/renderer/components/History';
import Toast from '@shared/renderer/components/Toast';
import {
  resetPasswordConfirmation,
  isResetPasswordLoading,
  getResetPasswordError,
  clearResetPasswordError,
  generatePassword,
  showSuccessMessage,
  getFlashMessage,
  clearFlashMessage,
} from '@shared/renderer/redux';

import { passwordResetConfirmFormSchema } from '../../../users/validator/auth';

import s from './ResetPasswordConfirmation.css';

/**
 * Reset Password Confirmation Page Component
 * Standalone full-page form explicitly mapped via Radix Box layouts resolving CSS imports natively.
 */
function ResetPasswordConfirmation({ token }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const loading = useSelector(isResetPasswordLoading);
  const error = useSelector(getResetPasswordError);
  const flashMessage = useSelector(getFlashMessage);
  const [success, setSuccess] = useState(false);
  const toastRef = useRef(null);

  // Handle flash messages
  useEffect(() => {
    if (flashMessage && toastRef.current) {
      toastRef.current.show({
        variant: flashMessage.variant || 'info',
        message: flashMessage.message,
        title: flashMessage.title,
        duration: flashMessage.duration || 4000,
      });
      dispatch(clearFlashMessage());
    }
  }, [flashMessage, dispatch]);

  // Clear error on unmount
  useEffect(() => {
    return () => {
      dispatch(clearResetPasswordError());
    };
  }, [dispatch]);

  const handleSubmit = useCallback(
    async data => {
      try {
        await dispatch(
          resetPasswordConfirmation({
            token,
            password: data.password,
            confirmPassword: data.confirmPassword,
          }),
        ).unwrap();
        setSuccess(true);
      } catch {
        // Error is handled by Redux state
      }
    },
    [token, dispatch],
  );

  return (
    <Flex className={s.pageContainer}>
      <HeroSection />

      <Flex align='center' justify='center' className={s.contentWrapper}>
        <Card size='4' variant='classic' className={s.formCard}>
          <Form.Error message={error} />

          {success ? (
            <Flex direction='column' align='center' className={s.successBox}>
              <Text size='8' color='green' mb='3'>
                ✓
              </Text>
              <Text size='3' color='green' mb='5'>
                <Trans
                  t={t}
                  i18nKey='resetPasswordConfirmation.success'
                  // eslint-disable-next-line react/jsx-key
                  components={[<strong />]}
                />
              </Text>
              <Button asChild variant='solid' className={s.loginLinkBtn}>
                <Link to='/login'>
                  {t('resetPasswordConfirmation.goToLogin', 'Go to Login')}
                </Link>
              </Button>
            </Flex>
          ) : (
            <Form
              schema={passwordResetConfirmFormSchema}
              defaultValues={{
                token,
                password: '',
                confirmPassword: '',
              }}
              onSubmit={handleSubmit}
            >
              <ResetFormFields loading={loading} dispatch={dispatch} />
            </Form>
          )}

          <Flex justify='center' mt='5'>
            <Text size='2' color='gray'>
              <Trans
                t={t}
                i18nKey='resetPasswordConfirmation.backToLogin'
                defaults='Changed your mind? <0>Back to Login</0>'
                components={[
                  <Link key='link' to='/login' className={s.backLink} />,
                ]}
              />
            </Text>
          </Flex>
        </Card>
      </Flex>
      <Toast ref={toastRef} />
    </Flex>
  );
}

ResetPasswordConfirmation.propTypes = {
  token: PropTypes.string.isRequired,
};

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
          {t('resetPasswordConfirmation.title', 'Set New Password')}
        </Heading>
        <Text size='4' className={s.heroSubtitle}>
          {t(
            'resetPasswordConfirmation.subtitle',
            'Create a strong password for your account',
          )}
        </Text>
      </Flex>
    </Flex>
  );
}

/**
 * Reset Form Fields
 */
function ResetFormFields({ loading, dispatch }) {
  const { t } = useTranslation();
  const {
    setValue,
    formState: { isSubmitting },
  } = useFormContext();

  // Password generation state
  const [generatingPassword, setGeneratingPassword] = useState(false);

  const handleGeneratePassword = useCallback(async () => {
    setGeneratingPassword(true);
    try {
      const password = await dispatch(generatePassword()).unwrap();
      setValue('password', password, { shouldValidate: true });
      setValue('confirmPassword', password, { shouldValidate: true });
      dispatch(
        showSuccessMessage({
          message: t(
            'resetPasswordConfirmation.passwordGenerated',
            'Password generated successfully!',
          ),
        }),
      );
    } catch {
      // Error handled silently
    } finally {
      setGeneratingPassword(false);
    }
  }, [dispatch, setValue, t]);

  return (
    <Flex direction='column' gap='4'>
      <Form.Field
        name='password'
        label={t('resetPasswordConfirmation.newPassword', 'New Password')}
      >
        <Form.Password />
      </Form.Field>

      <Form.Field
        name='confirmPassword'
        label={t(
          'resetPasswordConfirmation.confirmNewPassword',
          'Confirm New Password',
        )}
      >
        <Form.Password />
      </Form.Field>

      <Flex justify='end'>
        <Button
          variant='ghost'
          size='1'
          onClick={handleGeneratePassword}
          disabled={generatingPassword}
          className={clsx(s.generateBtn, {
            [s.generateBtnLoading]: generatingPassword,
            [s.generateBtnReady]: !generatingPassword,
          })}
        >
          {generatingPassword ? (
            t('resetPasswordConfirmation.generatingPassword', 'Generating...')
          ) : (
            <>
              <LockOpen1Icon width={14} height={14} />
              {t(
                'resetPasswordConfirmation.generatePassword',
                'Generate Secure Password',
              )}
            </>
          )}
        </Button>
      </Flex>

      <Button
        variant='solid'
        color='indigo'
        size='2'
        type='submit'
        mt='2'
        className={s.submitBtn}
        loading={loading || isSubmitting}
      >
        {loading
          ? t('resetPasswordConfirmation.loading', 'Resetting...')
          : t('resetPasswordConfirmation.submit', 'Reset Password')}
      </Button>
    </Flex>
  );
}

ResetFormFields.propTypes = {
  loading: PropTypes.bool,
  dispatch: PropTypes.func.isRequired,
};

export default ResetPasswordConfirmation;
