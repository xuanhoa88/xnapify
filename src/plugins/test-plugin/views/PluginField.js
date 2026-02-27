/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useCallback } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import Form from '../../../shared/renderer/components/Form';
import { PLUGIN_ID } from '../constants';
import s from './PluginField.scss';

export default function PluginField({ register, context }) {
  const { t } = useTranslation(PLUGIN_ID);

  const handleAsyncValidate = useCallback(
    async value => {
      // Only check if it's at least 3 characters
      if (!value || value.length < 3) return true;
      try {
        const response = await context.fetch(
          `/api/plugins/${__PLUGIN_NAME__}/ipc`,
          {
            method: 'POST',
            body: {
              action: 'checkNickname',
              data: { nickname: value },
            },
          },
        );
        if (response.success && response.data && response.data.exists) {
          return t('nickname_taken', 'This nickname is already taken');
        }
        return true;
      } catch (err) {
        console.error('Failed to check nickname:', err);
        return true; // Don't block on network errors
      }
    },
    [context, t],
  );

  return (
    <>
      <Form.Field
        name='profile.nickname'
        label={t('nickname', 'Nickname')}
        asyncValidate={handleAsyncValidate}
      >
        <Form.Input {...register('profile.nickname')} />
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
