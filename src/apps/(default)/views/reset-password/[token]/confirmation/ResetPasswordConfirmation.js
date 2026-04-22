/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useCallback, useState, useEffect } from 'react';

import {
  LockOpen1Icon,
  CrossCircledIcon,
  UpdateIcon,
} from '@radix-ui/react-icons';
import { Flex, Text, Heading, Button } from '@radix-ui/themes';
import PropTypes from 'prop-types';
import { useTranslation, Trans } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import Form, { useFormContext } from '@shared/renderer/components/Form';
import { Link } from '@shared/renderer/components/History';
import {
  resetPasswordConfirmation,
  isResetPasswordLoading,
  getResetPasswordError,
  clearResetPasswordError,
  generatePassword,
  showSuccessMessage,
} from '@shared/renderer/redux';

import { passwordResetConfirmFormSchema } from '../../../../../users/validator/auth';

/**
 * Reset Password Confirmation Page Component
 */
function ResetPasswordConfirmation({ context: { params } }) {
  const { token } = params;
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
    <>
      <Flex direction='column' align='center' mb='7'>
        <Heading
          as='h2'
          size='7'
          mb='2'
          weight='bold'
          className='text-slate-900 tracking-tight'
        >
          {t('resetPasswordConfirmation.title', 'Set New Password')}
        </Heading>
        <Text size='3' className='text-slate-500 font-medium'>
          {t(
            'resetPasswordConfirmation.subtitle',
            'Create a strong password for your account',
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
          <Text size='3' mb='5' className='text-emerald-700 font-semibold'>
            <Trans t={t} i18nKey='resetPasswordConfirmation.success' />
          </Text>
          <Button
            asChild
            variant='solid'
            color='indigo'
            size='3'
            className='w-full cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md'
          >
            <Link to='/login'>
              {t('resetPasswordConfirmation.goToLogin', 'Go to Login')}
            </Link>
          </Button>
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
                  t(
                    'resetPasswordConfirmation.error',
                    'Failed to reset password',
                  )}
              </Text>
            </Flex>
          )}
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
            i18nKey='resetPasswordConfirmation.backToLogin'
            defaults='Changed your mind? <0>Back to Login</0>'
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

ResetPasswordConfirmation.propTypes = {
  context: PropTypes.shape({
    params: PropTypes.shape({
      token: PropTypes.string.isRequired,
    }).isRequired,
  }).isRequired,
};

/**
 * Reset Form Fields
 */
function ResetFormFields({ loading, dispatch }) {
  const { t } = useTranslation();
  const {
    setValue,
    formState: { isSubmitting },
  } = useFormContext();

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
          type='button'
          onClick={handleGeneratePassword}
          disabled={generatingPassword}
          className='cursor-pointer'
        >
          {generatingPassword ? (
            <>
              <UpdateIcon className='animate-spin' width={14} height={14} />
              {t(
                'resetPasswordConfirmation.generatingPassword',
                'Generating...',
              )}
            </>
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
        size='3'
        type='submit'
        className='w-full cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md'
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
