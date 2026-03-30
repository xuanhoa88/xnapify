/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { forwardRef, useCallback, useState } from 'react';

import clsx from 'clsx';
import PropTypes from 'prop-types';
import { useFormContext } from 'react-hook-form';

import { useFormField, useMergeRefs } from '../FormContext';

import s from './FormFileUpload.css';

/**
 * FormFileUpload - File upload with drag-and-drop support
 *
 * Usage:
 *   <Form.Field name="avatar" label="Profile Picture">
 *     <Form.FileUpload accept="image/*" />
 *   </Form.Field>
 */
const FormFileUpload = forwardRef(function FormFileUpload$(
  { accept, className, disabled, multiple = false, ...props },
  forwardedRef,
) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const { id, name, error } = useFormField();
  const { register, setValue } = useFormContext();

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
    <div
      className={clsx(
        s.uploadWrapper,
        {
          [s.dragging]: isDragging,
          [s.hasFile]: selectedFile,
          [s.error]: error,
          [s.disabled]: disabled,
        },
        className,
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        id={id}
        type='file'
        accept={accept}
        disabled={disabled}
        multiple={multiple}
        className={s.input}
        {...registerProps}
        onChange={handleFileChange}
        ref={handleRef}
        {...props}
      />
      <label htmlFor={id} className={s.label}>
        <svg
          className={s.icon}
          viewBox='0 0 24 24'
          fill='none'
          stroke='currentColor'
        >
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth='2'
            d='M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12'
          />
        </svg>
        <span className={s.text}>
          {selectedFile ? (
            <strong>{getFileName()}</strong>
          ) : (
            <>
              <strong>Click to upload</strong> or drag and drop
            </>
          )}
        </span>
        {accept && (
          <span className={s.hint}>{accept.replace(/\*/g, 'All')}</span>
        )}
      </label>
    </div>
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
