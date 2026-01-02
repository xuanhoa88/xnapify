/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import { FormSchemaContext } from './FormContext';
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
  const methods = useForm({
    resolver: schema ? zodResolver(schema) : undefined,
    defaultValues,
    mode: 'onChange', // Validates on every change - works reliably on desktop and mobile
  });

  const handleFormSubmit = methods.handleSubmit(async data => {
    if (typeof onSubmit === 'function') {
      await onSubmit(data, methods);
    }
  });

  return (
    <FormSchemaContext.Provider value={schema}>
      <FormProvider {...methods}>
        <form
          className={clsx(s.form, className)}
          {...props}
          onSubmit={handleFormSubmit}
          noValidate
        >
          {children}
        </form>
      </FormProvider>
    </FormSchemaContext.Provider>
  );
}

Form.propTypes = {
  /** Form content (form fields) */
  children: PropTypes.node.isRequired,
  /** Zod validation schema */
  schema: PropTypes.object,
  /** Default form values */
  defaultValues: PropTypes.object,
  /** Form submission handler */
  onSubmit: PropTypes.func,
  /** Additional CSS class names */
  className: PropTypes.string,
};

export default Form;
