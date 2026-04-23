/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useCallback, useMemo } from 'react';

import { Box, Text } from '@radix-ui/themes';
import PropTypes from 'prop-types';

import Icon from '../../../Icon';
import { toType } from '../utils';

import AddKeyModal from './AddKeyModal';
import CopyToClipboard from './CopyToClipboard';
import VariableEditor from './VariableEditor';

import s from './ObjectNode.css';

const INDENT_PX = 5;

export default function ObjectNode({
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
    <Box
      className={isRoot ? s.jsvRoot : s.objectKeyVal}
      // eslint-disable-next-line react/forbid-dom-props
      style={{ paddingLeft }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Brace row with toggle */}
      <Text
        as='span'
        className={s.braceRow}
        onClick={() => setExpanded(prev => !prev)}
      >
        <Text as='span' className={s.iconContainer}>
          {expanded ? (
            <Icon name='ChevronDownIcon' size={15} className={s.jsonIconInherit} />
          ) : (
            <Icon name='ChevronRightIcon' size={15} className={s.jsonIconInherit} />
          )}
        </Text>
        {name !== false && (
          <Text as='span' className={s.objectKey}>
            {typeof name === 'string' ? `"${name}":` : `${name}:`}
          </Text>
        )}
        <Text as='span' className={s.brace}>
          {isArray ? '[' : '{'}
        </Text>
      </Text>

      {/* Meta data (size, add/remove icons) */}
      {expanded && (
        <Text as='span' className={s.objectMetaData}>
          {displayObjectSize && (
            <Text as='span' className={s.objectSize}>
              {size} item{size === 1 ? '' : 's'}
            </Text>
          )}
          <CopyToClipboard src={src} enableClipboard={enableClipboard} />
          {onAdd !== false && hovered && (
            <Text as='span' className={s.hoverActions}>
              <Icon
                name='PlusIcon'
                size={15}
                className={s.addIcon}
                onClick={e => {
                  e.stopPropagation();
                  setAddKeyActive(true);
                }}
              />
            </Text>
          )}
          {onDelete !== false && hovered && !isRoot && (
            <Text as='span' className={s.hoverActions}>
              <Icon
                name='CrossCircledIcon'
                size={15}
                className={s.removeIcon}
                onClick={e => {
                  e.stopPropagation();
                  handleRemoveSelf();
                }}
              />
            </Text>
          )}
        </Text>
      )}

      {/* Collapsed ellipsis */}
      {!expanded && (
        <Text
          as='span'
          className={s.ellipsis}
          onClick={() => setExpanded(true)}
        >
          ...
        </Text>
      )}

      {/* Expanded children */}
      {expanded && (
        <Box className={s.pushedContent}>
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
        </Box>
      )}

      {/* Closing brace */}
      <Text as='span' className={s.braceRow}>
        <Text
          as='span'
          className={s.brace}
          // eslint-disable-next-line react/forbid-dom-props
          style={{ paddingLeft: expanded ? '3px' : '0px' }}
        >
          {isArray ? ']' : '}'}
        </Text>
        {!expanded && displayObjectSize && (
          <Text as='span' className={s.objectSize}>
            {size} item{size === 1 ? '' : 's'}
          </Text>
        )}
      </Text>

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
    </Box>
  );
}

ObjectNode.propTypes = {
  src: PropTypes.any.isRequired,
  name: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
    PropTypes.bool,
  ]).isRequired,
  namespace: PropTypes.arrayOf(
    PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  ).isRequired,
  depth: PropTypes.number.isRequired,
  collapsed: PropTypes.oneOfType([PropTypes.bool, PropTypes.number]).isRequired,
  shouldCollapse: PropTypes.func,
  sortKeys: PropTypes.bool.isRequired,
  indentWidth: PropTypes.number.isRequired,
  enableClipboard: PropTypes.oneOfType([PropTypes.func, PropTypes.bool])
    .isRequired,
  displayObjectSize: PropTypes.bool.isRequired,
  displayDataTypes: PropTypes.bool.isRequired,
  collapseStringsAfterLength: PropTypes.number.isRequired,
  onEdit: PropTypes.oneOfType([PropTypes.func, PropTypes.bool]).isRequired,
  onDelete: PropTypes.oneOfType([PropTypes.func, PropTypes.bool]).isRequired,
  onAdd: PropTypes.oneOfType([PropTypes.func, PropTypes.bool]).isRequired,
  onVariableUpdate: PropTypes.func.isRequired,
  isRoot: PropTypes.bool.isRequired,
  parentType: PropTypes.string,
  defaultValue: PropTypes.any,
};
