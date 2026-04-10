/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useFormContext, Controller } from 'react-hook-form';

import '../../../validator';
import FormCheckbox from './Checkbox';
import FormCheckboxList from './CheckboxList';
import FormDate from './Date';
import FormDateRange from './DateRange';
import FormError from './Error';
import FormField from './Field';
import FormFileUpload from './FileUpload';
import Form from './Form';
import { useFormValidation, useFormField } from './FormContext';
import FormInput from './Input';
import FormJson from './Json';
import FormInputMask from './InputMask';
import FormLabel from './Label';
import FormNumberInput from './Number';
import FormPasswordInput from './Password';
import FormRadio from './Radio';
import FormSearchableSelect from './SearchableSelect';
import FormSelect from './Select';
import FormSwitch from './Switch';
import FormTextarea from './Textarea';
import useAsyncValidator from './useAsyncValidator';
import FormWYSIWYG from './WYSIWYG';

// Attach sub-components
Form.Field = FormField;
Form.Label = FormLabel;
Form.Input = FormInput;
Form.InputMask = FormInputMask;
Form.Date = FormDate;
Form.DateRange = FormDateRange;
Form.DateTime = FormDate;
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
Form.WYSIWYG = FormWYSIWYG;
Form.Json = FormJson;

// Export hooks for custom usage
export {
  useFormContext,
  useFormValidation,
  useFormField,
  useAsyncValidator,
  Controller,
  Form,
};

export default Form;
