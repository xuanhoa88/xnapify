/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useRef, useEffect } from 'react';

import { Box, TextField, Select, Text } from '@radix-ui/themes';
import PropTypes from 'prop-types';

import Icon from '../../../Icon';

import { getInitialType } from './DataTypeLabel';

import s from './AddKeyModal.css';

export default function AddKeyModal({
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
    <Box className={s.keyModalOverlay} onClick={onCancel}>
      <Box className={s.keyModal} onClick={e => e.stopPropagation()}>
        {!isArray && (
          <>
            <Box className={s.keyModalLabel}>Key Name:</Box>
            <Box className={s.keyModalInputWrapperField}>
              <TextField.Root
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
              >
                <TextField.Input />
              </TextField.Root>
            </Box>
          </>
        )}
        <Box className={s.keyModalLabel}>Type:</Box>
        <Box className={s.keyModalInputWrapper}>
          <Select.Root value={valueType} onValueChange={setValueType}>
            <Select.Trigger
              ref={valueSelectRef}
              className={s.keyModalInput}
              onKeyDown={e => {
                if (isValid && e.key === 'Enter') handleSubmit();
                if (e.key === 'Escape') onCancel();
              }}
            />
            <Select.Content>
              <Select.Item value='string'>String</Select.Item>
              <Select.Item value='number'>Number</Select.Item>
              <Select.Item value='boolean'>Boolean</Select.Item>
              <Select.Item value='object'>Object</Select.Item>
              <Select.Item value='array'>Array</Select.Item>
              <Select.Item value='null'>Null</Select.Item>
            </Select.Content>
          </Select.Root>
          {isValid && (
            <Icon
              name='check-circle'
              size={15}
              className={s.keyModalSubmit}
              onClick={handleSubmit}
            />
          )}
        </Box>
        <Text as='span' className={s.keyModalCancel}>
          <Icon
            name='x-circle'
            size={15}
            className={s.jsonIcon15}
            onClick={onCancel}
          />
        </Text>
      </Box>
    </Box>
  );
}

AddKeyModal.propTypes = {
  existingKeys: PropTypes.arrayOf(PropTypes.string).isRequired,
  isArray: PropTypes.bool.isRequired,
  onSubmit: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  defaultValue: PropTypes.any,
};
