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

import {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  forwardRef,
} from 'react';

import PropTypes from 'prop-types';

import Icon from '../../Icon';

import { toType, parseInput, stringifyVariable, deepCopy } from './utils';

import s from './JsonView.css';

/* eslint-disable jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, react/prop-types */

// =============================================================================
// HELPERS
// =============================================================================

const INDENT_PX = 5;

function DataTypeLabel({ type, show }) {
  if (!show) return null;
  return <span className={s.dataTypeLabel}>{type}</span>;
}

function getInitialType(val) {
  if (val === null) return 'null';
  if (Array.isArray(val)) return 'array';
  if (typeof val === 'object') return 'object';
  if (typeof val === 'boolean') return 'boolean';
  if (typeof val === 'number') return 'number';
  return 'string';
}

// =============================================================================
// VALUE RENDERERS
// =============================================================================

function JsonString({ value, displayDataTypes, collapseStringsAfterLength }) {
  const [collapsed, setCollapsed] = useState(true);
  const collapsible =
    typeof collapseStringsAfterLength === 'number' &&
    value.length > collapseStringsAfterLength;

  const display =
    collapsible && collapsed
      ? `${value.substring(0, collapseStringsAfterLength)}...`
      : value;

  return (
    <div className={s.stringValue}>
      <DataTypeLabel type='string' show={displayDataTypes} />
      <span
        style={{ cursor: collapsible ? 'pointer' : 'default' }}
        onClick={() => collapsible && setCollapsed(prev => !prev)}
      >
        &quot;{display}&quot;
      </span>
    </div>
  );
}

function JsonInteger({ value, displayDataTypes }) {
  return (
    <div className={s.integerValue}>
      <DataTypeLabel type='int' show={displayDataTypes} />
      {value}
    </div>
  );
}

function JsonFloat({ value, displayDataTypes }) {
  return (
    <div className={s.floatValue}>
      <DataTypeLabel type='float' show={displayDataTypes} />
      {value}
    </div>
  );
}

function JsonBoolean({ value, displayDataTypes }) {
  return (
    <div className={s.booleanValue}>
      <DataTypeLabel type='bool' show={displayDataTypes} />
      {value ? 'true' : 'false'}
    </div>
  );
}

function JsonNull({ displayDataTypes }) {
  return (
    <div className={s.nullValue}>
      <DataTypeLabel type='null' show={displayDataTypes} />
      NULL
    </div>
  );
}

function JsonUndefined() {
  return <div className={s.undefinedValue}>undefined</div>;
}

function JsonNan() {
  return <div className={s.nanValue}>NaN</div>;
}

function JsonDate({ value, displayDataTypes }) {
  const display = value.toLocaleTimeString('en-us', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  return (
    <div className={s.dateValue}>
      <DataTypeLabel type='date' show={displayDataTypes} />
      {display}
    </div>
  );
}

function JsonRegexp({ value, displayDataTypes }) {
  return (
    <div className={s.regexpValue}>
      <DataTypeLabel type='regexp' show={displayDataTypes} />
      {value.toString()}
    </div>
  );
}

function JsonFunction({ value, displayDataTypes }) {
  const [collapsed, setCollapsed] = useState(true);
  const str = value.toString().slice(9, -1);
  const header = str.replace(/\{[\s\S]+/, '');

  return (
    <div className={s.functionValue}>
      <DataTypeLabel type='fn' show={displayDataTypes} />
      <span onClick={() => setCollapsed(prev => !prev)}>
        {collapsed ? (
          <span>
            {header}
            <span className={s.functionValueCollapsed}>
              {'{'}
              <span className={s.ellipsis}>...</span>
              {'}'}
            </span>
          </span>
        ) : (
          str
        )}
      </span>
    </div>
  );
}

/**
 * Renders the correct value component based on the variable type.
 */
function ValueRenderer({ value, type, ...props }) {
  switch (type) {
    case 'string':
      return <JsonString value={value} {...props} />;
    case 'integer':
      return <JsonInteger value={value} {...props} />;
    case 'float':
      return <JsonFloat value={value} {...props} />;
    case 'boolean':
      return <JsonBoolean value={value} {...props} />;
    case 'null':
      return <JsonNull {...props} />;
    case 'undefined':
      return <JsonUndefined />;
    case 'nan':
      return <JsonNan />;
    case 'date':
      return <JsonDate value={value} {...props} />;
    case 'regexp':
      return <JsonRegexp value={value} {...props} />;
    case 'function':
      return <JsonFunction value={value} {...props} />;
    default:
      return <span>{JSON.stringify(value)}</span>;
  }
}

// =============================================================================
// CLIPBOARD
// =============================================================================

function CopyToClipboard({ src, enableClipboard }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    const type = toType(src);
    let val;
    if (type === 'function' || type === 'regexp') {
      val = src.toString();
    } else {
      try {
        val = JSON.stringify(src, null, '  ');
      } catch {
        val = String(src);
      }
    }

    // Use modern clipboard API when available
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(val);
    }

    setCopied(true);
    if (typeof enableClipboard === 'function') {
      enableClipboard({ src, namespace: [] });
    }
    setTimeout(() => setCopied(false), 1500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, enableClipboard]);

  if (!enableClipboard) return null;

  return (
    <span className={s.copyContainer} title='Copy to clipboard'>
      <span className={s.clipboardIcon} onClick={handleCopy}>
        <Icon name='copy' size={15} />
        {copied && (
          <span className={s.clipboardChecked}>
            <Icon name='check' size={15} />
          </span>
        )}
      </span>
    </span>
  );
}

// =============================================================================
// ADD KEY MODAL
// =============================================================================

function AddKeyModal({
  existingKeys,
  isArray,
  onSubmit,
  onCancel,
  defaultValue,
}) {
  const [keyInput, setKeyInput] = useState('');
  const [valueType, setValueType] = useState(getInitialType(defaultValue));

  const keyInputRef = useRef(null);
  const valueSelectRef = useRef(null);

  const isValid =
    isArray || (keyInput !== '' && !existingKeys.includes(keyInput));

  useEffect(() => {
    if (isArray && valueSelectRef.current) valueSelectRef.current.focus();
    else if (!isArray && keyInputRef.current) keyInputRef.current.focus();
  }, [isArray]);

  const handleSubmit = () => {
    if (!isValid) return;
    let finalValue;
    switch (valueType) {
      case 'string':
        finalValue = '';
        break;
      case 'number':
        finalValue = 0;
        break;
      case 'boolean':
        finalValue = false;
        break;
      case 'object':
        finalValue = {};
        break;
      case 'array':
        finalValue = [];
        break;
      case 'null':
        finalValue = null;
        break;
      default:
        finalValue = '';
        break;
    }
    onSubmit(isArray ? null : keyInput, finalValue);
  };

  return (
    <div className={s.keyModalOverlay} onClick={onCancel}>
      <div className={s.keyModal} onClick={e => e.stopPropagation()}>
        {!isArray && (
          <>
            <div className={s.keyModalLabel}>Key Name:</div>
            <div className={s.keyModalInputWrapperField}>
              <input
                ref={keyInputRef}
                className={s.keyModalInput}
                spellCheck={false}
                value={keyInput}
                placeholder='...'
                onChange={e => setKeyInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Escape') onCancel();
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (valueSelectRef.current) valueSelectRef.current.focus();
                  }
                }}
              />
            </div>
          </>
        )}
        <div className={s.keyModalLabel}>Type:</div>
        <div className={s.keyModalInputWrapper}>
          <select
            ref={valueSelectRef}
            className={s.keyModalInput}
            value={valueType}
            onChange={e => setValueType(e.target.value)}
            onKeyDown={e => {
              if (isValid && e.key === 'Enter') handleSubmit();
              if (e.key === 'Escape') onCancel();
            }}
          >
            <option value='string'>String</option>
            <option value='number'>Number</option>
            <option value='boolean'>Boolean</option>
            <option value='object'>Object</option>
            <option value='array'>Array</option>
            <option value='null'>Null</option>
          </select>
          {isValid && (
            <Icon
              name='check-circle'
              size={15}
              className={s.keyModalSubmit}
              onClick={handleSubmit}
            />
          )}
        </div>
        <span className={s.keyModalCancel}>
          <Icon
            name='x-circle'
            size={15}
            style={{ fontSize: '15px' }}
            onClick={onCancel}
          />
        </span>
      </div>
    </div>
  );
}

// =============================================================================
// VALIDATION FAILURE
// =============================================================================

function ValidationFailure({ message, active, onDismiss }) {
  if (!active) return null;
  return (
    <div className={s.validationFailure} onClick={onDismiss}>
      <span className={s.validationFailureLabel}>{message}</span>
      <Icon name='x' size={15} style={{ verticalAlign: 'middle' }} />
    </div>
  );
}

// =============================================================================
// VARIABLE EDITOR (leaf nodes)
// =============================================================================

function VariableEditor({
  name,
  value,
  namespace,
  indentWidth,
  onEdit,
  onDelete,
  enableClipboard,
  displayDataTypes,
  collapseStringsAfterLength,
  onVariableUpdate,
  isRoot,
}) {
  const [editMode, setEditMode] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [hovered, setHovered] = useState(false);
  const type = toType(value);

  const handleStartEdit = () => {
    setEditValue(stringifyVariable(value));
    setEditMode(true);
  };

  const handleSubmitEdit = useCallback(
    useDetected => {
      let newValue = editValue;
      if (useDetected) {
        const detected = parseInput(editValue);
        if (detected.type) newValue = detected.value;
      }
      setEditMode(false);
      onVariableUpdate({
        name,
        namespace,
        existing_value: value,
        new_value: newValue,
        variable_removed: false,
      });
    },
    [editValue, name, namespace, value, onVariableUpdate],
  );

  const handleDelete = useCallback(() => {
    onVariableUpdate({
      name,
      namespace,
      existing_value: value,
      variable_removed: true,
    });
  }, [name, namespace, value, onVariableUpdate]);

  const paddingLeft = isRoot ? 0 : indentWidth * INDENT_PX;

  return (
    <div
      className={s.variableRow}
      style={{ paddingLeft }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span className={s.objectKey}>{`"${name}":`}</span>
      <div className={s.variableValue}>
        {editMode ? (
          <div className={s.editModeContainer}>
            <textarea
              className={s.editInput}
              value={editValue}
              rows={2}
              onChange={e => setEditValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape') setEditMode(false);
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey))
                  handleSubmitEdit(true);
                e.stopPropagation();
              }}
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
            />
            <div className={s.editIconContainer}>
              <Icon
                name='x-circle'
                size={15}
                className={s.cancelIcon}
                onClick={() => setEditMode(false)}
              />
              <Icon
                name='check-circle'
                size={15}
                className={s.checkIcon}
                onClick={() => handleSubmitEdit(false)}
              />
              <DetectedType editValue={editValue} />
            </div>
          </div>
        ) : (
          <ValueRenderer
            value={value}
            type={type}
            displayDataTypes={displayDataTypes}
            collapseStringsAfterLength={collapseStringsAfterLength}
          />
        )}
      </div>
      {/* Action icons (only on hover) */}
      {hovered && !editMode && (
        <span className={s.variableHoverActions}>
          {enableClipboard && (
            <CopyToClipboard src={value} enableClipboard={enableClipboard} />
          )}
          {onEdit !== false && (
            <Icon
              name='edit-2'
              size={15}
              className={s.editIcon}
              onClick={handleStartEdit}
            />
          )}
          {onDelete !== false && !isRoot && (
            <Icon
              name='x-circle'
              size={15}
              className={s.removeIcon}
              onClick={handleDelete}
            />
          )}
        </span>
      )}
    </div>
  );
}

function DetectedType({ editValue }) {
  const detected = parseInput(editValue);
  if (!detected.type) return null;
  return (
    <div className={s.detectedRow}>
      <span className={s.dataTypeLabel}>detected: {detected.type}</span>
    </div>
  );
}

// =============================================================================
// OBJECT NODE (recursive)
// =============================================================================

function ObjectNode({
  src,
  name,
  namespace,
  depth,
  collapsed: collapsedProp,
  shouldCollapse,
  sortKeys,
  indentWidth,
  enableClipboard,
  displayObjectSize,
  displayDataTypes,
  collapseStringsAfterLength,
  onEdit,
  onDelete,
  onAdd,
  onVariableUpdate,
  isRoot,
  parentType,
  defaultValue,
}) {
  const objectType = toType(src);
  const isArray = objectType === 'array';
  const size = isArray ? src.length : Object.keys(src).length;

  // Determine initial collapsed state
  const initialCollapsed = useMemo(() => {
    if (typeof shouldCollapse === 'function') {
      return shouldCollapse({ name, src, type: objectType, namespace });
    }
    if (typeof collapsedProp === 'boolean') return collapsedProp;
    if (typeof collapsedProp === 'number') return depth >= collapsedProp;
    return false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [expanded, setExpanded] = useState(!initialCollapsed);
  const [hovered, setHovered] = useState(false);
  const [addKeyActive, setAddKeyActive] = useState(false);

  let keys = Object.keys(src);
  if (sortKeys && !isArray) keys = keys.sort();

  const handleAddKey = useCallback(
    (keyName, value) => {
      const newSrc = isArray ? [...src, value] : { ...src, [keyName]: value };
      setAddKeyActive(false);
      onVariableUpdate({
        name: isRoot ? null : name,
        namespace,
        existing_value: src,
        new_value: newSrc,
        variable_removed: false,
      });
    },
    [src, isArray, isRoot, name, namespace, onVariableUpdate],
  );

  const handleRemoveSelf = useCallback(() => {
    onVariableUpdate({
      name,
      namespace,
      existing_value: src,
      variable_removed: true,
    });
  }, [name, namespace, src, onVariableUpdate]);

  const paddingLeft =
    isRoot || parentType === 'array_group' ? 0 : indentWidth * INDENT_PX;

  const childProps = {
    indentWidth,
    enableClipboard,
    displayObjectSize,
    displayDataTypes,
    collapseStringsAfterLength,
    onEdit,
    onDelete,
    onAdd,
    onVariableUpdate,
    sortKeys,
    collapsed: collapsedProp,
    shouldCollapse,
    defaultValue,
  };

  return (
    <div
      className={isRoot ? s.jsvRoot : s.objectKeyVal}
      style={{ paddingLeft }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Brace row with toggle */}
      <span className={s.braceRow} onClick={() => setExpanded(prev => !prev)}>
        <span className={s.iconContainer}>
          {expanded ? (
            <Icon name='chevronDown' size={15} style={{ color: 'inherit' }} />
          ) : (
            <Icon name='chevronRight' size={15} style={{ color: 'inherit' }} />
          )}
        </span>
        {name !== false && (
          <span className={s.objectKey}>
            {typeof name === 'string' ? `"${name}":` : `${name}:`}
          </span>
        )}
        <span className={s.brace}>{isArray ? '[' : '{'}</span>
      </span>

      {/* Meta data (size, add/remove icons) */}
      {expanded && (
        <span className={s.objectMetaData}>
          {displayObjectSize && (
            <span className={s.objectSize}>
              {size} item{size === 1 ? '' : 's'}
            </span>
          )}
          <CopyToClipboard src={src} enableClipboard={enableClipboard} />
          {onAdd !== false && hovered && (
            <span className={s.hoverActions}>
              <Icon
                name='plus'
                size={15}
                className={s.addIcon}
                onClick={e => {
                  e.stopPropagation();
                  setAddKeyActive(true);
                }}
              />
            </span>
          )}
          {onDelete !== false && hovered && !isRoot && (
            <span className={s.hoverActions}>
              <Icon
                name='x-circle'
                size={15}
                className={s.removeIcon}
                onClick={e => {
                  e.stopPropagation();
                  handleRemoveSelf();
                }}
              />
            </span>
          )}
        </span>
      )}

      {/* Collapsed ellipsis */}
      {!expanded && (
        <span className={s.ellipsis} onClick={() => setExpanded(true)}>
          ...
        </span>
      )}

      {/* Expanded children */}
      {expanded && (
        <div className={s.pushedContent}>
          {keys.map(key => {
            const childValue = src[key];
            const childType = toType(childValue);
            const childNamespace = [...namespace, key];
            const childName =
              isArray && parentType !== 'array_group' ? parseInt(key, 10) : key;

            if (childType === 'object' || childType === 'array') {
              return (
                <ObjectNode
                  key={key}
                  src={childValue}
                  name={childName}
                  namespace={childNamespace}
                  depth={depth + 1}
                  parentType={objectType}
                  isRoot={false}
                  {...childProps}
                />
              );
            }

            return (
              <VariableEditor
                key={`${key}_${namespace.join('.')}`}
                name={childName}
                value={childValue}
                namespace={namespace}
                indentWidth={indentWidth}
                isRoot={false}
                onEdit={onEdit}
                onDelete={onDelete}
                enableClipboard={enableClipboard}
                displayDataTypes={displayDataTypes}
                collapseStringsAfterLength={collapseStringsAfterLength}
                onVariableUpdate={onVariableUpdate}
              />
            );
          })}
        </div>
      )}

      {/* Closing brace */}
      <span className={s.braceRow}>
        <span
          className={s.brace}
          style={{ paddingLeft: expanded ? '3px' : '0px' }}
        >
          {isArray ? ']' : '}'}
        </span>
        {!expanded && displayObjectSize && (
          <span className={s.objectSize}>
            {' '}
            {size} item{size === 1 ? '' : 's'}
          </span>
        )}
      </span>

      {/* Add Key Modal */}
      {addKeyActive && (
        <AddKeyModal
          existingKeys={Object.keys(src)}
          isArray={isArray}
          onSubmit={handleAddKey}
          onCancel={() => setAddKeyActive(false)}
          defaultValue={defaultValue}
        />
      )}
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/* eslint-enable react/prop-types */

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
      <div
        ref={ref}
        id={id}
        className={`${s.root} ${error ? s.rootError : ''} ${className || ''}`}
        style={userStyle}
      >
        <span style={{ color: 'red' }}>
          Error: src must be an object or array
        </span>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      id={id}
      className={`${s.root} ${disabled ? s.rootDisabled : ''} ${error ? s.rootError : ''} ${className || ''}`}
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
    </div>
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
