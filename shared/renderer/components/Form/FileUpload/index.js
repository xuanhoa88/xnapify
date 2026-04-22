/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { forwardRef, useCallback, useState, useEffect } from 'react';

import { UploadIcon } from '@radix-ui/react-icons';
import { Flex, Text, Box } from '@radix-ui/themes';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import { useFormContext, useWatch } from 'react-hook-form';

import { useFormField, useMergeRefs } from '../FormContext';

import s from './FileUpload.css';

/**
 * FormFileUpload - File upload with drag-and-drop support (Radix baked styles)
 *
 * Usage:
 *   <Form.Field name="avatar" label="Profile Picture">
 *     <Form.FileUpload accept="image/*" />
 *   </Form.Field>
 */
const FormFileUpload = forwardRef(function FormFileUpload$(
  { accept, className, disabled, multiple = false },
  forwardedRef,
) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const { id, name, error } = useFormField();
  const { register, setValue, control } = useFormContext();

  // Watch for form resets breaking internal selectedFile state sync
  const formValue = useWatch({ control, name });
  useEffect(() => {
    if (!formValue && selectedFile) {
      setSelectedFile(null);
    }
  }, [formValue, selectedFile]);

  // Get registration props including ref
  const { ref: registerRef, onChange, ...registerProps } = register(name);

  // Merge refs
  const handleRef = useMergeRefs(registerRef, forwardedRef);

  const handleFileChange = useCallback(
    e => {
      const { files } = e.target;
      if (files && files.length > 0) {
        setSelectedFile(multiple ? Array.from(files) : files[0]);
        setValue(name, multiple ? files : files[0]);
      }
      if (typeof onChange === 'function') onChange(e);
    },
    [multiple, name, setValue, onChange],
  );

  const handleDragOver = useCallback(
    e => {
      e.preventDefault();
      if (!disabled) setIsDragging(true);
    },
    [disabled],
  );

  const handleDragLeave = useCallback(e => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    e => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled) return;

      const { files } = e.dataTransfer;
      if (files && files.length > 0) {
        setSelectedFile(multiple ? Array.from(files) : files[0]);
        setValue(name, multiple ? files : files[0]);
      }
    },
    [multiple, name, setValue, disabled],
  );

  const getFileName = useCallback(() => {
    if (!selectedFile) return null;
    if (Array.isArray(selectedFile)) {
      return selectedFile.length === 1
        ? selectedFile[0].name
        : `${selectedFile.length} files selected`;
    }
    return selectedFile.name;
  }, [selectedFile]);

  return (
    <Box
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={clsx(
        className,
        s.container,
        disabled ? s.containerDisabled : s.containerInteractive,
        {
          [s.containerError]: error,
          [s.containerDragActive]: isDragging && !error,
          [s.containerSelected]: selectedFile && !error && !isDragging,
        },
      )}
    >
      <Box
        as='input'
        id={id}
        type='file'
        accept={accept}
        disabled={disabled}
        multiple={multiple}
        {...registerProps}
        onChange={handleFileChange}
        ref={handleRef}
        className={clsx(
          s.hiddenInput,
          disabled ? s.containerDisabled : s.containerInteractive,
        )}
      />
      <Box
        as='label'
        htmlFor={id}
        className={clsx(
          s.labelDropZone,
          disabled ? s.containerDisabled : s.containerInteractive,
        )}
      >
        <Flex direction='column' align='center' gap='2'>
          <UploadIcon
            width='24'
            height='24'
            color={
              error
                ? 'var(--red-9)'
                : selectedFile
                  ? 'var(--indigo-9)'
                  : 'var(--gray-9)'
            }
            className={s.icon}
          />
          <Text
            size='2'
            color={error ? 'red' : selectedFile ? 'indigo' : 'gray'}
          >
            {selectedFile ? (
              <Text weight='bold'>{getFileName()}</Text>
            ) : (
              <>
                <Text weight='bold'>Click to upload</Text> or drag and drop
              </>
            )}
          </Text>
          {accept && (
            <Text size='1' color='gray'>
              {accept.replace(/\*/g, 'All')}
            </Text>
          )}
        </Flex>
      </Box>
    </Box>
  );
});

FormFileUpload.propTypes = {
  /** Accepted file types (e.g., "image/*", ".pdf") */
  accept: PropTypes.string,
  /** Additional CSS class names */
  className: PropTypes.string,
  /** Disabled state */
  disabled: PropTypes.bool,
  /** Allow multiple file selection */
  multiple: PropTypes.bool,
};

export default FormFileUpload;
