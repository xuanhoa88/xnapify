/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * JsonView — Interactive JSON tree viewer/editor.
 * Derived from react-json-view by Mac Gainor (MIT License).
 * Completely rewritten for React 18 with hooks and CSS Modules.
 *
 * Features:
 * - Collapsible tree view for objects and arrays
 * - Inline editing of values (string, number, boolean, null)
 * - Add/remove keys and array items
 * - Copy to clipboard
 * - Data type labels
 * - Fully self-contained — no external dependencies
 */

import { useState, useCallback, useEffect, forwardRef } from 'react';

import { Box, Text } from '@radix-ui/themes';
import clsx from 'clsx';
import PropTypes from 'prop-types';

import ObjectNode from './components/ObjectNode';
import ValidationFailure from './components/ValidationFailure';
import { toType, deepCopy } from './utils';

import s from './JsonView.css';

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * JsonView — Interactive JSON tree viewer/editor.
 *
 * Usage:
 *   <JsonView
 *     src={{ key: "value" }}
 *     onEdit={({ updated_src }) => console.log(updated_src)}
 *     onAdd={({ updated_src }) => console.log(updated_src)}
 *     onDelete={({ updated_src }) => console.log(updated_src)}
 *   />
 *
 * @param {Object} props
 * @param {React.Ref} ref - Forwarded ref for form integration
 */
const JsonView = forwardRef(function JsonView$(
  {
    src: srcProp,
    id,
    name = 'root',
    collapsed = false,
    shouldCollapse,
    sortKeys = false,
    indentWidth = 4,
    enableClipboard = true,
    displayObjectSize = true,
    displayDataTypes = true,
    collapseStringsAfterLength,
    onEdit,
    onDelete,
    onAdd,
    onChange,
    onBlur,
    style: userStyle,
    validationMessage = 'Validation Error',
    defaultValue = null,
    disabled = false,
    error = false,
    className,
  },
  ref,
) {
  const [src, setSrc] = useState(srcProp);
  const [validationFailure, setValidationFailure] = useState(false);

  // Sync from props when srcProp changes identity
  useEffect(() => {
    setSrc(srcProp);
  }, [srcProp]);

  const handleVariableUpdate = useCallback(
    request => {
      const {
        name: varName,
        namespace,
        new_value,
        existing_value,
        variable_removed,
      } = request;

      // Deep copy src walking the namespace path
      const nsCopy = [...namespace];
      nsCopy.shift(); // remove root name

      let updatedSrc = deepCopy(src, [...nsCopy]);
      let walk = updatedSrc;
      for (const idx of nsCopy) {
        walk = walk[idx];
      }

      if (variable_removed) {
        if (Array.isArray(walk)) {
          walk.splice(varName, 1);
        } else {
          delete walk[varName];
        }
      } else if (varName !== null) {
        walk[varName] = new_value;
      } else {
        updatedSrc = new_value;
      }

      // Build the callback payload
      const payload = {
        existing_src: src,
        new_value,
        updated_src: updatedSrc,
        name: varName,
        namespace,
        existing_value,
      };

      // Determine which callback to invoke
      let result;
      if (variable_removed && onDelete) {
        result = onDelete(payload);
      } else if (varName === null && onAdd) {
        // New value for entire root
        result = onEdit ? onEdit(payload) : true;
      } else if (onEdit) {
        // Check if this was an add or edit
        const wasAdd =
          existing_value === undefined ||
          (typeof existing_value === 'object' &&
            new_value !== undefined &&
            Object.keys(new_value).length >
              Object.keys(existing_value || {}).length);
        if (wasAdd && onAdd) {
          result = onAdd(payload);
        } else {
          result = onEdit(payload);
        }
      }

      if (result !== false) {
        setSrc(updatedSrc);
        if (typeof onChange === 'function') {
          onChange(updatedSrc);
        }
      } else {
        setValidationFailure(true);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [src, onEdit, onDelete, onAdd, onChange],
  );

  const rootType = toType(src);

  if (rootType !== 'object' && rootType !== 'array') {
    return (
      <Box
        ref={ref}
        id={id}
        className={clsx(s.root, { [s.rootError]: error, className })}
        style={userStyle}
      >
        <Text as='span' className={s.jsonErrorText}>
          Error: src must be an object or array
        </Text>
      </Box>
    );
  }

  return (
    <Box
      ref={ref}
      id={id}
      className={clsx(s.root, {
        [s.rootDisabled]: disabled,
        [s.rootError]: error,
        className,
      })}
      style={userStyle}
      onBlur={onBlur}
    >
      <ValidationFailure
        message={validationMessage}
        active={validationFailure}
        onDismiss={() => setValidationFailure(false)}
      />
      <ObjectNode
        src={src}
        name={name}
        namespace={[name]}
        depth={0}
        isRoot
        parentType={null}
        collapsed={collapsed}
        shouldCollapse={shouldCollapse}
        sortKeys={sortKeys}
        indentWidth={indentWidth}
        enableClipboard={enableClipboard}
        displayObjectSize={displayObjectSize}
        displayDataTypes={displayDataTypes}
        collapseStringsAfterLength={collapseStringsAfterLength}
        onEdit={onEdit !== undefined ? onEdit : false}
        onDelete={onDelete !== undefined ? onDelete : false}
        onAdd={onAdd !== undefined ? onAdd : false}
        onVariableUpdate={handleVariableUpdate}
        defaultValue={defaultValue}
      />
    </Box>
  );
});

JsonView.propTypes = {
  /** Source JSON object or array */
  src: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
  /** HTML id for label association */
  id: PropTypes.string,
  /** Root node name */
  name: PropTypes.oneOfType([PropTypes.string, PropTypes.bool]),
  /** Collapse depth (boolean for all, number for level) */
  collapsed: PropTypes.oneOfType([PropTypes.bool, PropTypes.number]),
  /** Function to determine collapse: ({ name, src, type, namespace }) => boolean */
  shouldCollapse: PropTypes.func,
  /** Sort object keys alphabetically */
  sortKeys: PropTypes.bool,
  /** Indentation width (multiplied by 5px) */
  indentWidth: PropTypes.number,
  /** Enable copy-to-clipboard (boolean or callback) */
  enableClipboard: PropTypes.oneOfType([PropTypes.bool, PropTypes.func]),
  /** Show object/array size badge */
  displayObjectSize: PropTypes.bool,
  /** Show data type labels */
  displayDataTypes: PropTypes.bool,
  /** Collapse strings longer than this */
  collapseStringsAfterLength: PropTypes.number,
  /** Edit callback: (payload) => false to reject */
  onEdit: PropTypes.oneOfType([PropTypes.func, PropTypes.bool]),
  /** Delete callback: (payload) => false to reject */
  onDelete: PropTypes.oneOfType([PropTypes.func, PropTypes.bool]),
  /** Add callback: (payload) => false to reject */
  onAdd: PropTypes.oneOfType([PropTypes.func, PropTypes.bool]),
  /** Simple change handler — receives updated_src */
  onChange: PropTypes.func,
  /** Blur handler for form touched state tracking */
  onBlur: PropTypes.func,
  /** Inline style overrides */
  style: PropTypes.object,
  /** Validation failure message */
  validationMessage: PropTypes.string,
  /** Default value for newly added keys */
  defaultValue: PropTypes.any,
  /** Disable all interactions */
  disabled: PropTypes.bool,
  /** Show error state (red border) */
  error: PropTypes.bool,
  /** Additional CSS class */
  className: PropTypes.string,
};

export default JsonView;
