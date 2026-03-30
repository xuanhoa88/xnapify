/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useCallback, useEffect, useState } from 'react';

import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import Button from '@shared/renderer/components/Button';
import Form, { useFormContext } from '@shared/renderer/components/Form';
import Icon from '@shared/renderer/components/Icon';
import {
  changeUserPassword,
  isPasswordLoading,
  getPasswordError,
  clearPasswordError,
  generatePassword,
  showSuccessMessage,
} from '@shared/renderer/redux';

import { changePasswordFormSchema } from '../../../../users/validator/auth';

import s from './SecurityCard.css';

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
    <div className={s.card}>
      <div className={s.cardHeader}>
        <div className={s.cardIcon}>
          <Icon name='lock' size={22} />
        </div>
        <div>
          <h2 className={s.cardTitle}>{t('profile.security', 'Security')}</h2>
          <p className={s.cardDescription}>
            {t('profile.securityDesc', 'Manage your password and security')}
          </p>
        </div>
      </div>

      <div className={s.securityTips}>
        <div className={s.tipItem}>
          <Icon name='check-circle' size={16} />
          <span>{t('profile.passwordTip1', 'Use at least 8 characters')}</span>
        </div>
        <div className={s.tipItem}>
          <Icon name='check-circle' size={16} />
          <span>
            {t(
              'profile.passwordTip2',
              'Mix uppercase, lowercase, numbers & symbols',
            )}
          </span>
        </div>
        <div className={s.tipItem}>
          <Icon name='check-circle' size={16} />
          <span>
            {t('profile.passwordTip3', 'Avoid common words or personal info')}
          </span>
        </div>
      </div>

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
    </div>
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
    <>
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

      <div className={s.generatePasswordLink}>
        <Button
          variant='unstyled'
          size='small'
          onClick={handleGeneratePassword}
          disabled={generatingPassword}
          className={s.generateBtn}
        >
          {generatingPassword ? (
            t('profile.generatingPassword', 'Generating...')
          ) : (
            <>
              <Icon name='key' size={14} />
              {t('profile.generatePassword', 'Generate Secure Password')}
            </>
          )}
        </Button>
      </div>

      <Button
        variant='secondary'
        type='submit'
        className={s.buttonSecondary}
        loading={loading || isSubmitting}
      >
        {loading
          ? t('profile.changingPassword', 'Changing Password...')
          : t('profile.updatePassword', 'Update Password')}
      </Button>
    </>
  );
}

SecurityFormFields.propTypes = {
  loading: PropTypes.bool,
  dispatch: PropTypes.func.isRequired,
};

export default SecurityCard;
