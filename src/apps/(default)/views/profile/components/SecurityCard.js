/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useCallback, useEffect, useState } from 'react';

import {
  LockClosedIcon,
  CheckCircledIcon,
  LockOpen1Icon,
} from '@radix-ui/react-icons';
import { Flex, Box, Text, Heading, Button } from '@radix-ui/themes';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import Form, { useFormContext } from '@shared/renderer/components/Form';
import { features } from '@shared/renderer/redux';

import { changePasswordFormSchema } from '../../../../users/validator/auth';

import s from './SecurityCard.css';

const {
  changeUserPassword,
  isPasswordLoading,
  getPasswordError,
  clearPasswordError,
  generatePassword,
  showSuccessMessage,
} = features;

function SecurityCard() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const loading = useSelector(isPasswordLoading);
  const error = useSelector(getPasswordError);

  // Clear error on unmount
  useEffect(() => {
    return () => {
      dispatch(clearPasswordError());
    };
  }, [dispatch]);

  const handleSubmit = useCallback(
    async (data, { reset }) => {
      try {
        await dispatch(
          changeUserPassword({
            currentPassword: data.currentPassword,
            newPassword: data.newPassword,
          }),
        ).unwrap();
        reset();
        dispatch(
          showSuccessMessage({
            title: t('profile.saved', 'Saved'),
            message: t(
              'profile.passwordChanged',
              'Password changed successfully',
            ),
          }),
        );
      } catch {
        // Error is handled by Redux state
      }
    },
    [dispatch, t],
  );

  return (
    <Box className={s.cardContainer}>
      <Flex align='center' gap='4' mb='6'>
        <Flex
          align='center'
          justify='center'
          width='48px'
          height='48px'
          className={s.cardHeaderIconIndigo}
        >
          <LockClosedIcon width={24} height={24} />
        </Flex>
        <Box>
          <Heading as='h2' size='5' highContrast>
            {t('profile.security', 'Security')}
          </Heading>
          <Text size='3' color='gray'>
            {t('profile.securityDesc', 'Manage your password and security')}
          </Text>
        </Box>
      </Flex>

      <Flex direction='column' gap='3' className={s.tipsBox}>
        <Flex align='center' gap='2' className={s.infoItem}>
          <CheckCircledIcon width={16} height={16} />
          <Text size='3'>
            {t('profile.passwordTip1', 'Use at least 8 characters')}
          </Text>
        </Flex>
        <Flex align='center' gap='2' className={s.infoItem}>
          <CheckCircledIcon width={16} height={16} />
          <Text size='3'>
            {t(
              'profile.passwordTip2',
              'Mix uppercase, lowercase, numbers & symbols',
            )}
          </Text>
        </Flex>
        <Flex align='center' gap='2' className={s.infoItem}>
          <CheckCircledIcon width={16} height={16} />
          <Text size='3'>
            {t('profile.passwordTip3', 'Avoid common words or personal info')}
          </Text>
        </Flex>
      </Flex>

      <Form.Error message={error || ''} />

      <Form
        schema={changePasswordFormSchema}
        defaultValues={{
          currentPassword: '',
          newPassword: '',
          confirmNewPassword: '',
        }}
        onSubmit={handleSubmit}
      >
        <SecurityFormFields loading={loading} dispatch={dispatch} />
      </Form>
    </Box>
  );
}

function SecurityFormFields({ loading, dispatch }) {
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
      setValue('newPassword', password, { shouldValidate: true });
      setValue('confirmNewPassword', password, { shouldValidate: true });
      dispatch(
        showSuccessMessage({
          message: t(
            'profile.passwordGenerated',
            'Password generated successfully!',
          ),
        }),
      );
    } catch {
      // Error handled silently or via flash message
    } finally {
      setGeneratingPassword(false);
    }
  }, [dispatch, setValue, t]);

  return (
    <Flex direction='column' gap='4'>
      <Form.Field
        name='currentPassword'
        label={t('profile.currentPassword', 'Current Password')}
      >
        <Form.Password />
      </Form.Field>

      <Form.Field
        name='newPassword'
        label={t('profile.newPassword', 'New Password')}
      >
        <Form.Password />
      </Form.Field>

      <Form.Field
        name='confirmNewPassword'
        label={t('profile.confirmNewPassword', 'Confirm New Password')}
      >
        <Form.Password />
      </Form.Field>

      <Flex justify='end'>
        <Button
          variant='ghost'
          size='1'
          onClick={handleGeneratePassword}
          disabled={generatingPassword}
          className={
            generatingPassword ? s.generateBtnLoading : s.generateBtnReady
          }
        >
          {generatingPassword ? (
            t('profile.generatingPassword', 'Generating...')
          ) : (
            <>
              <LockOpen1Icon width={14} height={14} />
              {t('profile.generatePassword', 'Generate Secure Password')}
            </>
          )}
        </Button>
      </Flex>

      <Flex justify='end' mt='4'>
        <Button
          variant='solid'
          size='3'
          type='submit'
          loading={loading || isSubmitting}
        >
          {loading
            ? t('profile.changingPassword', 'Changing Password...')
            : t('profile.updatePassword', 'Update Password')}
        </Button>
      </Flex>
    </Flex>
  );
}

SecurityFormFields.propTypes = {
  loading: PropTypes.bool,
  dispatch: PropTypes.func.isRequired,
};

export default SecurityCard;
