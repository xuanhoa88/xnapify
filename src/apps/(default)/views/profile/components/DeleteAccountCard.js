/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useCallback, useEffect } from 'react';

import { TrashIcon, ExclamationTriangleIcon } from '@radix-ui/react-icons';
import { Flex, Box, Text, Heading, Button } from '@radix-ui/themes';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import Form, { useFormContext } from '@shared/renderer/components/Form';
import { useHistory } from '@shared/renderer/components/History';
import { features } from '@shared/renderer/redux';

import { deleteAccountFormSchema } from '../../../../users/validator/auth';

import s from './DeleteAccountCard.css';

const { deleteUser, isDeleteLoading, getDeleteError, clearDeleteError } =
  features;

/**
 * DeleteAccountCard adopting pure functional Radix implementations overriding primitive mapped styles.
 */
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
    <Box className={s.cardContainer}>
      <Flex align='center' gap='4' className={s.cardHeader}>
        <Box className={clsx(s.cardHeaderIcon, s.cardHeaderIconRed)}>
          <TrashIcon width={24} height={24} />
        </Box>
        <Box>
          <Heading as='h2' size='5' className={s.cardTitle}>
            {t('profile.deleteAccount', 'Delete Account')}
          </Heading>
          <Text size='3' color='gray'>
            {t(
              'profile.deleteAccountDesc',
              'Permanently delete your account and all data',
            )}
          </Text>
        </Box>
      </Flex>

      <Flex align='start' gap='3' className={s.warningBox}>
        <Box className={s.warningIcon}>
          <ExclamationTriangleIcon width={20} height={20} />
        </Box>
        <Box>
          <Text size='3' weight='bold' className={s.warningTitle}>
            {t('profile.deleteWarningTitle', 'Warning')}
          </Text>
          <Text size='3' className={s.warningText}>
            {t(
              'profile.deleteWarningText',
              'This action cannot be undone. All your data will be permanently deleted.',
            )}
          </Text>
        </Box>
      </Flex>

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
    </Box>
  );
}

function DeleteAccountFormFields({ loading }) {
  const { t } = useTranslation();
  const {
    formState: { isSubmitting },
  } = useFormContext();

  return (
    <Flex direction='column' gap='4'>
      <Form.Field
        name='password'
        label={t('profile.currentPassword', 'Current Password')}
      >
        <Form.Password />
      </Form.Field>

      <Form.Field
        name='confirmPassword'
        label={t('profile.confirmCurrentPassword', 'Confirm Current Password')}
      >
        <Form.Password />
      </Form.Field>

      <Flex justify='end' className={s.cardAction}>
        <Button
          color='red'
          variant='solid'
          size='3'
          type='submit'
          loading={loading || isSubmitting}
        >
          {loading
            ? t('profile.deletingAccount', 'Deleting Account...')
            : t('profile.deleteAccountButton', 'Delete My Account')}
        </Button>
      </Flex>
    </Flex>
  );
}

DeleteAccountFormFields.propTypes = {
  loading: PropTypes.bool,
};

export default DeleteAccountCard;
