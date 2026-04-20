/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useCallback, useMemo, useEffect } from 'react';

import { PersonIcon } from '@radix-ui/react-icons';
import { Flex, Box, Grid, Text, Heading, Button } from '@radix-ui/themes';
import clsx from 'clsx';
import merge from 'lodash/merge';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useSelector, useDispatch } from 'react-redux';

import {
  ExtensionSlot,
  useExtensionHooks,
  useExtensionValidator,
  useExtensionFormData,
} from '@shared/renderer/components/Extension';
import Form, { useFormContext } from '@shared/renderer/components/Form';
import {
  getUserProfile,
  updateUserProfile,
  isProfileLoading,
  getProfileError,
  clearProfileError,
  showSuccessMessage,
} from '@shared/renderer/redux';
import { z } from '@shared/validator';

import { updateProfileFormSchema } from '../../../../users/validator/auth';

import Loader from './Loader';

import s from './PersonalInfoCard.css';

function PersonalInfoCard() {
  const { t, i18n } = useTranslation();
  const dispatch = useDispatch();
  const user = useSelector(getUserProfile);
  const loading = useSelector(isProfileLoading);
  const error = useSelector(getProfileError);
  const extensionHooks = useExtensionHooks();

  const [extensionDefaultValues, loadingDefaultValues] = useExtensionFormData(
    'profile.personal_info.formData',
    user,
  );

  const baseSchema = useMemo(
    () => updateProfileFormSchema({ i18n, z }),
    [i18n],
  );

  const [extendedValidator, loadingValidator] = useExtensionValidator(
    'profile.personal_info.validator',
    baseSchema,
    z,
  );

  const formSchema = useCallback(() => extendedValidator, [extendedValidator]);

  useEffect(() => {
    return () => {
      dispatch(clearProfileError());
    };
  }, [dispatch]);

  const defaultValues = useMemo(
    () => merge({}, extensionDefaultValues, user),
    [user, extensionDefaultValues],
  );

  const handleSubmit = useCallback(
    async (data, { reset }) => {
      try {
        await dispatch(updateUserProfile(data)).unwrap();

        await extensionHooks.execute('profile.personal_info.submit', data, {
          dispatch,
          user,
        });

        reset(data);
        dispatch(
          showSuccessMessage({
            title: t('profile.saved', 'Saved'),
            message: t('profile.savedMessage', 'Profile updated successfully'),
          }),
        );
      } catch {
        // Error is handled by Redux state
      }
    },
    [dispatch, t, extensionHooks, user],
  );

  if (loadingDefaultValues || loadingValidator) {
    return <Loader />;
  }

  return (
    <Box className={s.cardContainer}>
      <Flex align='center' gap='4' className={s.cardHeader}>
        <Box className={clsx(s.cardHeaderIcon, s.cardHeaderIconIndigo)}>
          <PersonIcon width={24} height={24} />
        </Box>
        <Box>
          <Heading as='h2' size='5' className={s.cardTitle}>
            {t('profile.personalInfo', 'Personal Information')}
          </Heading>
          <Text size='3' color='gray'>
            {t('profile.personalInfoDesc', 'Update your personal details')}
          </Text>
        </Box>
      </Flex>

      <Form.Error message={error || ''} />

      <Form
        schema={formSchema}
        defaultValues={defaultValues}
        onSubmit={handleSubmit}
      >
        <PersonalInfoFormFields loading={loading} />
      </Form>
    </Box>
  );
}

function PersonalInfoFormFields({ loading }) {
  const { t } = useTranslation();
  const {
    register,
    formState: { isSubmitting, errors },
  } = useFormContext();

  return (
    <Flex direction='column' gap='4'>
      <Form.Field
        name='profile.display_name'
        label={t('profile.displayName', 'Display Name')}
      >
        <Form.Input
          type='text'
          placeholder={t(
            'profile.displayNamePlaceholder',
            'Enter your display name',
          )}
        />
      </Form.Field>

      <Grid columns={{ initial: '1', sm: '2' }} gap='4'>
        <Form.Field
          name='profile.first_name'
          label={t('profile.firstName', 'First Name')}
        >
          <Form.Input
            type='text'
            placeholder={t('profile.firstNamePlaceholder', 'First name')}
          />
        </Form.Field>
        <Form.Field
          name='profile.last_name'
          label={t('profile.lastName', 'Last Name')}
        >
          <Form.Input
            type='text'
            placeholder={t('profile.lastNamePlaceholder', 'Last name')}
          />
        </Form.Field>
      </Grid>

      <Form.Field name='profile.bio' label={t('profile.bio', 'Bio')}>
        <Form.WYSIWYG
          placeholder={t('profile.bioPlaceholder', 'Tell us about yourself...')}
        />
      </Form.Field>

      <Form.Field
        name='profile.location'
        label={t('profile.location', 'Location')}
      >
        <Form.Input
          type='text'
          placeholder={t('profile.locationPlaceholder', 'Your location')}
        />
      </Form.Field>

      <Form.Field
        name='profile.website'
        label={t('profile.website', 'Website')}
      >
        <Form.Input
          type='url'
          placeholder={t(
            'profile.websitePlaceholder',
            'https://yourwebsite.com',
          )}
        />
      </Form.Field>

      {/* Render extension slots */}
      <ExtensionSlot
        name='profile.personal_info.fields'
        register={register}
        errors={errors}
      />

      <Flex justify='end' className={s.cardAction}>
        <Button
          variant='solid'
          color='indigo'
          size='3'
          type='submit'
          loading={loading || isSubmitting}
        >
          {loading
            ? t('profile.saving', 'Saving...')
            : t('profile.saveChanges', 'Save Changes')}
        </Button>
      </Flex>
    </Flex>
  );
}

PersonalInfoFormFields.propTypes = {
  loading: PropTypes.bool,
};

export default PersonalInfoCard;
