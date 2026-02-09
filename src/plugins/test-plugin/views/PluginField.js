import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import Form from '../../../shared/renderer/components/Form';
import { PLUGIN_ID } from '../constants';
import s from './PluginField.scss';

export default function PluginField({ register }) {
  const { t } = useTranslation(PLUGIN_ID);
  return (
    <Form.Field name='nickname' label={t('nickname', 'Nickname')}>
      <Form.Input {...register('nickname')} />
      <div className={s.formText}>
        {t('nickname_hint', 'Added via Test Plugin (min 3 chars)')}
      </div>
    </Form.Field>
  );
}

PluginField.propTypes = {
  register: PropTypes.func.isRequired,
};
