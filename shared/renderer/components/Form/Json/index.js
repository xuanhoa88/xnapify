/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * FormJson — react-hook-form integration wrapper for JsonView.
 *
 * Bridges the JsonView interactive tree editor with the Form system.
 * JSON strings are parsed into objects for display, and serialized
 * back to strings when the value changes.
 *
 * Usage:
 *   <Form.Field name="config">
 *     <Form.Json collapsed={1} />
 *   </Form.Field>
 */

import { forwardRef, useMemo, useCallback } from 'react';

import PropTypes from 'prop-types';
import { useController } from 'react-hook-form';

import { useFormField, useMergeRefs } from '../FormContext';

import JsonView from './JsonView';

const FormJson = forwardRef(function FormJson$(
  {
    collapsed = 1,
    sortKeys = false,
    indentWidth = 4,
    enableClipboard = true,
    displayObjectSize = true,
    displayDataTypes = false,
    collapseStringsAfterLength,
    disabled,
    className,
    style,
    ...props
  },
  forwardedRef,
) {
  const { id, name, error } = useFormField();
  const {
    field: { onChange, onBlur, value, ref: registerRef },
  } = useController({ name });

  const handleRef = useMergeRefs(registerRef, forwardedRef);

  // Parse the string value into a JSON object for the viewer
  const parsedSrc = useMemo(() => {
    if (value == null || value === '') return {};
    if (typeof value === 'object') return value;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (typeof parsed === 'object' && parsed !== null) return parsed;
        return { value: parsed };
      } catch {
        return { _raw: value };
      }
    }
    return { value };
  }, [value]);

  // Serialize object → string for form state
  const handleChange = useCallback(
    updatedSrc => {
      try {
        onChange(JSON.stringify(updatedSrc, null, 2));
      } catch {
        onChange(String(updatedSrc));
      }
    },
    [onChange],
  );

  // Single callback for edit/add/delete — serialize updated_src
  const handleMutation = useCallback(
    payload => {
      handleChange(payload.updated_src);
      return true;
    },
    [handleChange],
  );

  return (
    <JsonView
      ref={handleRef}
      id={id}
      src={parsedSrc}
      name={false}
      collapsed={collapsed}
      sortKeys={sortKeys}
      indentWidth={indentWidth}
      enableClipboard={enableClipboard}
      displayObjectSize={displayObjectSize}
      displayDataTypes={displayDataTypes}
      collapseStringsAfterLength={collapseStringsAfterLength}
      onEdit={disabled ? false : handleMutation}
      onAdd={disabled ? false : handleMutation}
      onDelete={disabled ? false : handleMutation}
      onBlur={onBlur}
      disabled={disabled}
      error={!!error}
      className={className}
      style={style}
      {...props}
    />
  );
});

FormJson.propTypes = {
  /** Initial collapse depth */
  collapsed: PropTypes.oneOfType([PropTypes.bool, PropTypes.number]),
  /** Sort keys */
  sortKeys: PropTypes.bool,
  /** Indent width */
  indentWidth: PropTypes.number,
  /** Enable clipboard */
  enableClipboard: PropTypes.oneOfType([PropTypes.bool, PropTypes.func]),
  /** Show size badge */
  displayObjectSize: PropTypes.bool,
  /** Show type labels */
  displayDataTypes: PropTypes.bool,
  /** Collapse string threshold */
  collapseStringsAfterLength: PropTypes.number,
  /** Disabled state */
  disabled: PropTypes.bool,
  /** Custom class */
  className: PropTypes.string,
  /** Inline styles */
  style: PropTypes.object,
};

export default FormJson;
