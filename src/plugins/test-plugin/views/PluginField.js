import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import Form from '../../../shared/renderer/components/Form';
import { PLUGIN_ID } from '../constants';
import s from './PluginField.scss';

export default function PluginField({ register }) {
  const { t } = useTranslation(PLUGIN_ID);
  return (
    <>
      <Form.Field name='profile.nickname' label={t('nickname', 'Nickname')}>
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
};
