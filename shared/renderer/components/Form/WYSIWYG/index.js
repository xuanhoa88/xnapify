/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { forwardRef } from 'react';

import PropTypes from 'prop-types';
import { useController } from 'react-hook-form';

import { WYSIWYG } from '../../WYSIWYG';
import {
  useFormField,
  useMergeRefs,
  composeEventHandlers,
} from '../FormContext';

/**
 * FormWYSIWYG — A rich-text editor field powered by Tiptap.
 *
 * Thin wrapper around the standalone `<WYSIWYG>` component that integrates
 * with `react-hook-form` via `useFormField` and `useController`.
 *
 * @param {Object} props
 * @param {string}   [props.className]       Additional CSS class
 * @param {boolean}  [props.disabled]        Disable editing
 * @param {boolean}  [props.markdown=true]   When true (default), value uses markdown; when false, raw HTML
 * @param {string}   [props.placeholder]     Placeholder text
 * @param {Function} [props.onChange]         Callback fired on content change
 * @param {(query: string) => Promise<string[]>} [props.onMentionQuery]
 *   Async callback to search for mentionable items.
 * @param {Array}    [props.addExtensions]     Custom Tiptap extensions to add
 * @param {string[]} [props.excludeExtensions]  Array of extension names to exclude
 * @param {Object}   [props.editorProps]        Custom ProseMirror editorProps to merge
 */
const FormWYSIWYG = forwardRef(function FormWYSIWYG$(
  {
    className,
    disabled,
    markdown,
    placeholder,
    onChange: onChangeProp,
    onBlur: onBlurProp,
    onMentionQuery,
    addExtensions,
    excludeExtensions,
    editorProps,
    toolbarAppend,
  },
  forwardedRef,
) {
  const { id, name, error } = useFormField();
  const {
    field: { onChange, onBlur, value, ref: registerRef },
  } = useController({ name });

  const handleRef = useMergeRefs(registerRef, forwardedRef);

  return (
    <WYSIWYG
      ref={handleRef}
      id={id}
      className={className}
      disabled={disabled}
      error={!!error}
      markdown={markdown}
      placeholder={placeholder}
      value={value}
      onChange={composeEventHandlers(onChangeProp, onChange)}
      onBlur={composeEventHandlers(onBlurProp, onBlur)}
      onMentionQuery={onMentionQuery}
      addExtensions={addExtensions}
      excludeExtensions={excludeExtensions}
      editorProps={editorProps}
      toolbarAppend={toolbarAppend}
    />
  );
});

FormWYSIWYG.propTypes = {
  className: PropTypes.string,
  disabled: PropTypes.bool,
  markdown: PropTypes.bool,
  placeholder: PropTypes.string,
  onChange: PropTypes.func,
  onBlur: PropTypes.func,
  onMentionQuery: PropTypes.func,
  addExtensions: PropTypes.array,
  excludeExtensions: PropTypes.arrayOf(PropTypes.string),
  editorProps: PropTypes.object,
  toolbarAppend: PropTypes.func,
};

export default FormWYSIWYG;
