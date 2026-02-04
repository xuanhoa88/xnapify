import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import Form from '../../../shared/renderer/components/Form';

export default function PluginField({ register }) {
  const { t } = useTranslation();
  return (
    <Form.Field
      name='nickname'
      label={t('nickname', 'Nickname', {
        ns: 'test-plugin',
      })}
    >
      <Form.Input {...register('nickname')} />
      <div className='form-text'>Added via Test Plugin (min 3 chars)</div>
    </Form.Field>
  );
}

PluginField.propTypes = {
  register: PropTypes.func.isRequired,
};
