/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import PropTypes from 'prop-types';
import {
  getUserPreferences,
  updateUserPreferences,
  getUserProfile,
  getAvailableLocales,
  setLocale,
  getLocale,
  isPreferencesLoading,
  getPreferencesError,
  clearPreferencesError,
} from '../../../redux';
import { updatePreferencesFormSchema } from '../../../shared/validator/features/auth';
import Icon from '../../../components/Icon';
import Button from '../../../components/Button';
import Form, { useFormContext } from '../../../components/Form';
import s from './PreferencesCard.css';

// Default preferences values
const DEFAULT_PREFERENCES = Object.freeze({
  language: 'en-US',
  timezone: 'UTC',
  theme: 'system',
  notifications: {},
});

function PreferencesCard() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const hasFetched = useRef(false);

  // Get preferences from Redux
  const user = useSelector(getUserProfile);
  const currentLocale = useSelector(getLocale);
  const loading = useSelector(isPreferencesLoading);
  const error = useSelector(getPreferencesError);

  // Clear error on unmount
  useEffect(() => {
    return () => {
      dispatch(clearPreferencesError());
    };
  }, [dispatch]);

  // Fetch preferences on mount if not already in Redux
  useEffect(() => {
    if (!hasFetched.current && (!user || !user.preferences)) {
      hasFetched.current = true;
      dispatch(getUserPreferences());
    }
  }, [dispatch, user]);

  // Derive default values from Redux preferences (memoized)
  const defaultValues = useMemo(
    () => ({
      language:
        (user && user.preferences && user.preferences.language) ||
        DEFAULT_PREFERENCES.language,
      timezone:
        (user && user.preferences && user.preferences.timezone) ||
        DEFAULT_PREFERENCES.timezone,
      theme:
        (user && user.preferences && user.preferences.theme) ||
        DEFAULT_PREFERENCES.theme,
      notifications:
        (user && user.preferences && user.preferences.notifications) ||
        DEFAULT_PREFERENCES.notifications,
    }),
    [user],
  );

  // Handle form submit
  const handleSubmit = useCallback(
    async (data, { reset }) => {
      try {
        await dispatch(
          updateUserPreferences({
            language: data.language,
            timezone: data.timezone,
            theme: data.theme,
            notifications: data.notifications,
          }),
        ).unwrap();

        reset(data);

        // Update app locale if language changed
        if (data.language && data.language !== currentLocale) {
          dispatch(setLocale(data.language));
        }
      } catch {
        // Error is handled by Redux state
      }
    },
    [dispatch, currentLocale],
  );

  // Show loading state while fetching preferences
  if (loading && (!user || !user.preferences)) {
    return (
      <div className={s.card}>
        <div className={s.loading}>
          <Icon name='loader' size={24} />
          <span>{t('common.loading', 'Loading...')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={s.card}>
      <div className={s.cardHeader}>
        <div className={s.cardIcon}>
          <Icon name='settings' size={22} />
        </div>
        <div>
          <h2 className={s.cardTitle}>
            {t('profile.preferences', 'Preferences')}
          </h2>
          <p className={s.cardDescription}>
            {t(
              'profile.preferencesDesc',
              'Customize your experience and notifications',
            )}
          </p>
        </div>
      </div>

      <Form.Error message={error || ''} />

      <Form
        schema={updatePreferencesFormSchema}
        defaultValues={defaultValues}
        onSubmit={handleSubmit}
      >
        <PreferencesFormFields loading={loading} />
      </Form>
    </div>
  );
}

function PreferencesFormFields({ loading }) {
  const { t } = useTranslation();
  const availableLocales = useSelector(getAvailableLocales);
  const {
    formState: { isSubmitting },
  } = useFormContext();

  return (
    <>
      <Form.Field name='theme' label={t('profile.theme', 'Theme')}>
        <Form.Select
          options={[
            { value: 'system', label: t('profile.themeSystem', 'System') },
            { value: 'light', label: t('profile.themeLight', 'Light') },
            { value: 'dark', label: t('profile.themeDark', 'Dark') },
          ]}
          placeholder={t('profile.themePlaceholder', 'Select a theme')}
        />
      </Form.Field>

      <Form.Field name='language' label={t('profile.language', 'Language')}>
        <Form.Select
          options={Object.entries(availableLocales).map(([code, name]) => ({
            value: code,
            label: name,
          }))}
          placeholder={t('profile.languagePlaceholder', 'Select a language')}
        />
      </Form.Field>

      <Form.Field name='timezone' label={t('profile.timezone', 'Timezone')}>
        <Form.Select
          options={[
            { value: 'UTC', label: 'UTC' },
            { value: 'America/New_York', label: 'America/New_York (EST/EDT)' },
            { value: 'America/Chicago', label: 'America/Chicago (CST/CDT)' },
            { value: 'America/Denver', label: 'America/Denver (MST/MDT)' },
            {
              value: 'America/Los_Angeles',
              label: 'America/Los_Angeles (PST/PDT)',
            },
            { value: 'America/Sao_Paulo', label: 'America/Sao_Paulo (BRT)' },
            { value: 'Europe/London', label: 'Europe/London (GMT/BST)' },
            { value: 'Europe/Paris', label: 'Europe/Paris (CET/CEST)' },
            { value: 'Europe/Berlin', label: 'Europe/Berlin (CET/CEST)' },
            { value: 'Europe/Moscow', label: 'Europe/Moscow (MSK)' },
            { value: 'Asia/Dubai', label: 'Asia/Dubai (GST)' },
            { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST)' },
            { value: 'Asia/Bangkok', label: 'Asia/Bangkok (ICT)' },
            { value: 'Asia/Ho_Chi_Minh', label: 'Asia/Ho_Chi_Minh (ICT)' },
            { value: 'Asia/Singapore', label: 'Asia/Singapore (SGT)' },
            { value: 'Asia/Shanghai', label: 'Asia/Shanghai (CST)' },
            { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST)' },
            { value: 'Asia/Seoul', label: 'Asia/Seoul (KST)' },
            {
              value: 'Australia/Sydney',
              label: 'Australia/Sydney (AEST/AEDT)',
            },
            {
              value: 'Australia/Melbourne',
              label: 'Australia/Melbourne (AEST/AEDT)',
            },
            {
              value: 'Pacific/Auckland',
              label: 'Pacific/Auckland (NZST/NZDT)',
            },
            { value: 'Pacific/Honolulu', label: 'Pacific/Honolulu (HST)' },
          ]}
          placeholder={t('profile.timezonePlaceholder', 'Select a timezone')}
        />
      </Form.Field>

      <Button
        variant='primary'
        type='submit'
        className={s.button}
        loading={loading || isSubmitting}
      >
        {loading
          ? t('profile.saving')
          : t('profile.savePreferences', 'Save Preferences')}
      </Button>
    </>
  );
}

PreferencesFormFields.propTypes = {
  loading: PropTypes.bool,
};

export default PreferencesCard;
