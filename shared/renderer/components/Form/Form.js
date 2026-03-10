/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useEffect } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import { z } from '../../../validator';
import { FormValidationContext } from './FormContext';
import s from './Form.css';

/**
 * Form - Wrapper component that provides form context and validation
 *
 * Usage:
 *   <Form schema={loginFormSchema} onSubmit={handleSubmit}>
 *     <Form.Input name="email" label="Email" type="email" />
 *     <Form.Input name="password" label="Password" type="password" />
 *     <Form.Checkbox name="rememberMe" label="Remember me" />
 *     <button type="submit">Submit</button>
 *   </Form>
 */
function Form({
  children,
  schema,
  defaultValues = {},
  onSubmit,
  className,
  ...props
}) {
  const { i18n } = useTranslation();

  const methods = useForm({
    resolver:
      typeof schema === 'function'
        ? zodResolver(schema({ i18n, z }))
        : undefined,
    defaultValues,
    mode: 'onChange', // Validates on every change - works reliably on desktop and mobile
  });

  // Reset form when defaultValues change (e.g., when data loads asynchronously)
  // Note: Parent components should memoize defaultValues to avoid unnecessary resets.
  useEffect(() => {
    methods.reset(defaultValues);
  }, [defaultValues, methods]);

  const handleFormSubmit = methods.handleSubmit(async data => {
    if (typeof onSubmit === 'function') {
      await onSubmit(data, methods);
    }
  });

  return (
    <FormValidationContext.Provider value={{ schema, z }}>
      <FormProvider {...methods}>
        <form
          className={clsx(s.form, className)}
          {...props}
          noValidate
          onSubmit={handleFormSubmit}
        >
          {children}
        </form>
      </FormProvider>
    </FormValidationContext.Provider>
  );
}

Form.propTypes = {
  /** Form content (form fields) */
  children: PropTypes.node.isRequired,
  /** Zod validation schema factory function */
  schema: PropTypes.func,
  /** Default form values */
  defaultValues: PropTypes.object,
  /** Form submission handler */
  onSubmit: PropTypes.func,
  /** Additional CSS class names */
  className: PropTypes.string,
};

export default Form;
