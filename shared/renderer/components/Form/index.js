/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useFormContext, Controller } from 'react-hook-form';

import '@shared/validator';
import FormCheckbox from './Checkbox/index.js';
import FormCheckboxList from './CheckboxList/index.js';
import FormDate from './Date/index.js';
import FormDateRange from './DateRange/index.js';
import FormError from './Error/index.js';
import FormField from './Field/index.js';
import FormFileUpload from './FileUpload/index.js';
import Form from './Form.js';
import { useFormValidation, useFormField } from './FormContext.js';
import FormInput from './Input/index.js';
import FormInputMask from './InputMask/index.js';
import FormJson from './Json/index.js';
import FormLabel from './Label/index.js';
import FormNumberInput from './Number/index.js';
import FormPasswordInput from './Password/index.js';
import FormRadio from './Radio/index.js';
import FormSearchableSelect from './SearchableSelect/index.js';
import FormSelect from './Select/index.js';
import FormSwitch from './Switch/index.js';
import FormTextarea from './Textarea/index.js';
import useAsyncValidator from './useAsyncValidator.js';
import FormWYSIWYG from './WYSIWYG/index.js';

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
