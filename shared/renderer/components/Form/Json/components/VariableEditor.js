/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useCallback } from 'react';

import { Box, Text, TextArea } from '@radix-ui/themes';
import PropTypes from 'prop-types';

import Icon from '../../../Icon';
import { toType, parseInput, stringifyVariable } from '../utils';

import CopyToClipboard from './CopyToClipboard';
import ValueRenderer from './ValueRenderers';

import s from './VariableEditor.css';

const INDENT_PX = 5;

function DetectedType({ editValue }) {
  const detected = parseInput(editValue);
  if (!detected.type) return null;
  return (
    <Box className={s.detectedRow}>
      <Text as='span' className={s.dataTypeLabel}>
        detected: {detected.type}
      </Text>
    </Box>
  );
}

DetectedType.propTypes = {
  editValue: PropTypes.string.isRequired,
};

export default function VariableEditor({
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
    <Box
      className={s.variableRow}
      // eslint-disable-next-line react/forbid-dom-props
      style={{ paddingLeft }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Text as='span' className={s.objectKey}>{`"${name}":`}</Text>
      <Box className={s.variableValue}>
        {editMode ? (
          <Box className={s.editModeContainer}>
            <TextArea
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
            <Box className={s.editIconContainer}>
              <Icon
                name='CrossCircledIcon'
                size={15}
                className={s.cancelIcon}
                onClick={() => setEditMode(false)}
              />
              <Icon
                name='CheckCircledIcon'
                size={15}
                className={s.checkIcon}
                onClick={() => handleSubmitEdit(false)}
              />
              <DetectedType editValue={editValue} />
            </Box>
          </Box>
        ) : (
          <ValueRenderer
            value={value}
            type={type}
            displayDataTypes={displayDataTypes}
            collapseStringsAfterLength={collapseStringsAfterLength}
          />
        )}
      </Box>
      {/* Action icons (only on hover) */}
      {hovered && !editMode && (
        <Text as='span' className={s.variableHoverActions}>
          {enableClipboard && (
            <CopyToClipboard src={value} enableClipboard={enableClipboard} />
          )}
          {onEdit !== false && (
            <Icon
              name='Pencil2Icon'
              size={15}
              className={s.editIcon}
              onClick={handleStartEdit}
            />
          )}
          {onDelete !== false && !isRoot && (
            <Icon
              name='CrossCircledIcon'
              size={15}
              className={s.removeIcon}
              onClick={handleDelete}
            />
          )}
        </Text>
      )}
    </Box>
  );
}

VariableEditor.propTypes = {
  name: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  value: PropTypes.any.isRequired,
  namespace: PropTypes.arrayOf(
    PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  ).isRequired,
  indentWidth: PropTypes.number.isRequired,
  onEdit: PropTypes.oneOfType([PropTypes.func, PropTypes.bool]).isRequired,
  onDelete: PropTypes.oneOfType([PropTypes.func, PropTypes.bool]).isRequired,
  enableClipboard: PropTypes.oneOfType([PropTypes.func, PropTypes.bool])
    .isRequired,
  displayDataTypes: PropTypes.bool.isRequired,
  collapseStringsAfterLength: PropTypes.number.isRequired,
  onVariableUpdate: PropTypes.func.isRequired,
  isRoot: PropTypes.bool.isRequired,
};
