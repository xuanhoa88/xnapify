import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useFormContext, useWatch } from 'react-hook-form';
import Form from '../../../shared/renderer/components/Form';
import { PLUGIN_ID } from '../constants';
import s from './PluginField.scss';

export default function PluginField({ register, context }) {
  const { t } = useTranslation(PLUGIN_ID);
  const { control, setError, clearErrors } = useFormContext();
  const nickname = useWatch({ control, name: 'profile.nickname' });
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState(null);

  useEffect(() => {
    // Only check if it's at least 3 characters
    if (!nickname || nickname.length < 3) {
      setIsAvailable(null);
      clearErrors('profile.nickname.api');
      return;
    }

    const checkAvailability = async () => {
      setIsChecking(true);
      try {
        const response = await context.fetch(
          `/api/plugins/${__PLUGIN_NAME__}/ipc`,
          {
            method: 'POST',
            body: {
              action: 'checkNickname',
              data: { nickname },
            },
          },
        );

        if (response.success && response.data && response.data.exists) {
          setIsAvailable(false);
          setError('profile.nickname.api', {
            type: 'manual',
            message: t('nickname_taken', 'This nickname is already taken'),
          });
        } else {
          setIsAvailable(true);
          clearErrors('profile.nickname.api');
        }
      } catch (err) {
        console.error('Failed to check nickname:', err);
      } finally {
        setIsChecking(false);
      }
    };

    const timeoutId = setTimeout(checkAvailability, 500); // debounce 500ms
    return () => clearTimeout(timeoutId);
  }, [nickname, setError, clearErrors, t, context]);

  return (
    <>
      <Form.Field name='profile.nickname' label={t('nickname', 'Nickname')}>
        <div style={{ position: 'relative' }}>
          <Form.Input {...register('profile.nickname')} />
          {isChecking && (
            <span
              style={{
                position: 'absolute',
                right: 10,
                top: 10,
                fontSize: 12,
                color: 'gray',
              }}
            >
              Checking...
            </span>
          )}
          {isAvailable === true && (
            <span
              style={{
                position: 'absolute',
                right: 10,
                top: 10,
                fontSize: 12,
                color: 'green',
              }}
            >
              ✓ Available
            </span>
          )}
        </div>
        <div className={s.formText}>
          {t('nickname_hint', 'This field requires a minimum of 3 characters')}
        </div>
      </Form.Field>

      <Form.Field name='profile.birthday' label={t('birthday', 'Birthday')}>
        <Form.Date {...register('profile.birthday')} />
      </Form.Field>
    </>
  );
}

PluginField.propTypes = {
  register: PropTypes.func.isRequired,
  context: PropTypes.object,
};
