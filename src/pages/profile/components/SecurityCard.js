/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import PropTypes from 'prop-types';
import {
  changeUserPassword,
  isPasswordLoading,
  getPasswordError,
  clearPasswordError,
} from '../../../redux';
import { changePasswordFormSchema } from '../../../shared/validator/features/auth';
import Icon from '../../../components/Icon';
import Button from '../../../components/Button';
import Form, { useFormContext } from '../../../components/Form';
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
      } catch {
        // Error is handled by Redux state
      }
    },
    [dispatch],
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

      <Form.Error message={error || ''} />

      <Form
        schema={changePasswordFormSchema}
        defaultValues={{
          currentPassword: '',
          newPassword: '',
        }}
        onSubmit={handleSubmit}
      >
        <SecurityFormFields loading={loading} />
      </Form>
    </div>
  );
}

function SecurityFormFields({ loading }) {
  const { t } = useTranslation();
  const {
    formState: { isSubmitting },
  } = useFormContext();

  return (
    <>
      <Form.Field name='currentPassword' label={t('profile.currentPassword')}>
        <Form.Password />
      </Form.Field>

      <Form.Field name='newPassword' label={t('profile.newPassword')}>
        <Form.Password />
      </Form.Field>

      <Button
        variant='secondary'
        type='submit'
        className={s.buttonSecondary}
        loading={loading || isSubmitting}
      >
        {loading ? t('profile.changingPassword') : t('profile.updatePassword')}
      </Button>
    </>
  );
}

SecurityFormFields.propTypes = {
  loading: PropTypes.bool,
};

export default SecurityCard;
