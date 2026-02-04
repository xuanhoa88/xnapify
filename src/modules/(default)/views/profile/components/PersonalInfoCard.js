/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useCallback, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector, useDispatch } from 'react-redux';
import PropTypes from 'prop-types';
import { z } from '../../../../../shared/validator';
import {
  getUserProfile,
  updateUserProfile,
  isProfileLoading,
  getProfileError,
  clearProfileError,
  showSuccessMessage,
} from '../../../../../shared/renderer/redux';
import Icon from '../../../../../shared/renderer/components/Icon';
import Button from '../../../../../shared/renderer/components/Button';
import Form, {
  useFormContext,
} from '../../../../../shared/renderer/components/Form';
import {
  PluginSlot,
  usePluginSchema,
  usePluginHooks,
} from '../../../../../shared/plugin';
import { updateProfileFormSchema } from '../../../../users/validator/auth';
import s from './PersonalInfoCard.css';

function PersonalInfoCard() {
  const { t, i18n } = useTranslation(); // Destructure i18n
  const dispatch = useDispatch();
  const user = useSelector(getUserProfile);
  const loading = useSelector(isProfileLoading);
  const error = useSelector(getProfileError);
  const pluginHooks = usePluginHooks();

  // Instantiate base schema object
  const baseSchema = useMemo(
    () => updateProfileFormSchema({ i18n, z }),
    [i18n],
  );

  // Extend schema with plugins (returns Zod object)
  const extendedSchema = usePluginSchema(
    'profile.personal_info.schema',
    baseSchema,
    z,
  );

  // Wrap in factory for Form component
  const formSchema = useCallback(() => extendedSchema, [extendedSchema]);

  // Clear error on unmount
  useEffect(() => {
    return () => {
      dispatch(clearProfileError());
    };
  }, [dispatch]);

  // Derive default values from user (memoized to prevent unnecessary re-renders)
  const defaultValues = useMemo(
    () => ({
      display_name: (user && user.display_name) || '',
      first_name: (user && user.first_name) || '',
      last_name: (user && user.last_name) || '',
      bio: (user && user.bio) || '',
      location: (user && user.location) || '',
      website: (user && user.website) || '',
    }),
    [user],
  );

  // Handle form submit - Form component provides methods via callback
  const handleSubmit = useCallback(
    async (data, { reset }) => {
      try {
        await dispatch(updateUserProfile(data)).unwrap();

        // Execute plugin hooks
        await pluginHooks.execute('profile.personal_info.submit', data, {
          dispatch,
          user,
        });

        // Reset form with the new saved data
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
    [dispatch, t, pluginHooks, user],
  );

  return (
    <div className={s.card}>
      <div className={s.cardHeader}>
        <div className={s.cardIcon}>
          <Icon name='user' size={22} />
        </div>
        <div>
          <h2 className={s.cardTitle}>
            {t('profile.personalInfo', 'Personal Information')}
          </h2>
          <p className={s.cardDescription}>
            {t('profile.personalInfoDesc', 'Update your personal details')}
          </p>
        </div>
      </div>

      <Form.Error message={error || ''} />

      <Form
        schema={formSchema}
        defaultValues={defaultValues}
        onSubmit={handleSubmit}
      >
        <PersonalInfoFormFields loading={loading} />
      </Form>
    </div>
  );
}

function PersonalInfoFormFields({ loading }) {
  const { t } = useTranslation();
  const {
    register,
    formState: { isSubmitting, errors },
  } = useFormContext();

  return (
    <>
      <Form.Field name='display_name' label={t('profile.displayName')}>
        <Form.Input
          type='text'
          placeholder={t(
            'profile.displayNamePlaceholder',
            'Enter your display name',
          )}
        />
      </Form.Field>

      <div className={s.row}>
        <div className={s.col}>
          <Form.Field name='first_name' label={t('profile.firstName')}>
            <Form.Input
              type='text'
              placeholder={t('profile.firstNamePlaceholder', 'First name')}
            />
          </Form.Field>
        </div>
        <div className={s.col}>
          <Form.Field name='last_name' label={t('profile.lastName')}>
            <Form.Input
              type='text'
              placeholder={t('profile.lastNamePlaceholder', 'Last name')}
            />
          </Form.Field>
        </div>
      </div>

      <Form.Field name='bio' label={t('profile.bio')}>
        <Form.Textarea
          rows={3}
          placeholder={t('profile.bioPlaceholder', 'Tell us about yourself...')}
        />
      </Form.Field>

      <Form.Field name='location' label={t('profile.location')}>
        <Form.Input
          type='text'
          placeholder={t('profile.locationPlaceholder', 'Your location')}
        />
      </Form.Field>

      <Form.Field name='website' label={t('profile.website')}>
        <Form.Input
          type='url'
          placeholder={t(
            'profile.websitePlaceholder',
            'https://yourwebsite.com',
          )}
        />
      </Form.Field>

      {/* Render plugin slots */}
      <PluginSlot
        name='profile.personal_info.fields'
        register={register}
        errors={errors}
      />

      <Button
        variant='primary'
        type='submit'
        className={s.button}
        loading={loading || isSubmitting}
      >
        {loading ? t('profile.saving') : t('profile.saveChanges')}
      </Button>
    </>
  );
}

PersonalInfoFormFields.propTypes = {
  loading: PropTypes.bool,
};

export default PersonalInfoCard;
