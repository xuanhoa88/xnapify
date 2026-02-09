/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useFormContext, Controller } from 'react-hook-form';
import '../../../validator';
import Form from './Form';
import FormField from './Field';
import FormLabel from './Label';
import FormInput from './Input';
import FormPasswordInput from './Password';
import FormNumberInput from './Number';
import FormTextarea from './Textarea';
import FormSelect from './Select';
import FormCheckbox from './Checkbox';
import FormSwitch from './Switch';
import FormRadio from './Radio';
import FormFileUpload from './FileUpload';
import FormError from './Error';
import FormSearchableSelect from './SearchableSelect';
import FormCheckboxList from './CheckboxList';
import { useFormValidation, useFormField } from './FormContext';

// Attach sub-components
Form.Field = FormField;
Form.Label = FormLabel;
Form.Input = FormInput;
Form.Password = FormPasswordInput;
Form.Number = FormNumberInput;
Form.Textarea = FormTextarea;
Form.Select = FormSelect;
Form.SearchableSelect = FormSearchableSelect;
Form.Checkbox = FormCheckbox;
Form.CheckboxList = FormCheckboxList;
Form.Switch = FormSwitch;
Form.Radio = FormRadio;
Form.FileUpload = FormFileUpload;
Form.Error = FormError;

// Export hooks for custom usage
export { useFormContext, useFormValidation, useFormField, Controller };

export default Form;
