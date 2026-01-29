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
  deleteUser,
  isDeleteLoading,
  getDeleteError,
  clearDeleteError,
} from '../../../../../shared/renderer/redux';
import { useHistory } from '../../../../../shared/renderer/components/History';
import Icon from '../../../../../shared/renderer/components/Icon';
import Button from '../../../../../shared/renderer/components/Button';
import Form, {
  useFormContext,
} from '../../../../../shared/renderer/components/Form';
import { deleteAccountFormSchema } from '../../../../users/validator/auth';
import s from './DeleteAccountCard.css';

function DeleteAccountCard() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const history = useHistory();
  const loading = useSelector(isDeleteLoading);
  const error = useSelector(getDeleteError);

  // Clear error on unmount
  useEffect(() => {
    return () => {
      dispatch(clearDeleteError());
    };
  }, [dispatch]);

  const handleSubmit = useCallback(
    async (data, { reset }) => {
      try {
        await dispatch(
          deleteUser({
            password: data.password,
            confirmPassword: data.confirmPassword,
          }),
        ).unwrap();

        // Redirect to home page after account deletion
        history.push('/');
      } catch {
        // Error is handled by Redux state
        reset();
      }
    },
    [dispatch, history],
  );

  return (
    <div className={s.card}>
      <div className={s.cardHeader}>
        <div className={s.cardIcon}>
          <Icon name='trash' size={22} />
        </div>
        <div>
          <h2 className={s.cardTitle}>
            {t('profile.deleteAccount', 'Delete Account')}
          </h2>
          <p className={s.cardDescription}>
            {t(
              'profile.deleteAccountDesc',
              'Permanently delete your account and all data',
            )}
          </p>
        </div>
      </div>

      <div className={s.warning}>
        <Icon name='alert-triangle' size={18} />
        <div>
          <strong>{t('profile.deleteWarningTitle', 'Warning')}</strong>
          <p>
            {t(
              'profile.deleteWarningText',
              'This action cannot be undone. All your data will be permanently deleted.',
            )}
          </p>
        </div>
      </div>

      <Form.Error message={error || ''} />

      <Form
        schema={deleteAccountFormSchema}
        defaultValues={{
          password: '',
          confirmPassword: '',
        }}
        onSubmit={handleSubmit}
      >
        <DeleteAccountFormFields loading={loading} />
      </Form>
    </div>
  );
}

function DeleteAccountFormFields({ loading }) {
  const { t } = useTranslation();
  const {
    formState: { isSubmitting },
  } = useFormContext();

  return (
    <>
      <Form.Field name='password' label={t('profile.currentPassword')}>
        <Form.Password />
      </Form.Field>

      <Form.Field
        name='confirmPassword'
        label={t('profile.confirmCurrentPassword')}
      >
        <Form.Password />
      </Form.Field>

      <Button
        variant='danger'
        type='submit'
        className={s.buttonDanger}
        loading={loading || isSubmitting}
      >
        {loading
          ? t('profile.deletingAccount')
          : t('profile.deleteAccountButton', 'Delete My Account')}
      </Button>
    </>
  );
}

DeleteAccountFormFields.propTypes = {
  loading: PropTypes.bool,
};

export default DeleteAccountCard;
