/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  forwardRef,
  useState,
  useEffect,
  useRef,
  useImperativeHandle,
  useCallback,
  useMemo,
} from 'react';
import { useController } from 'react-hook-form';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Mention from '@tiptap/extension-mention';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import {
  Table,
  TableRow,
  TableHeader,
  TableCell,
} from '@tiptap/extension-table';
import { Link } from '@tiptap/extension-link';
import { Image } from '@tiptap/extension-image';
import { Youtube } from '@tiptap/extension-youtube';
import { Video, Audio } from './MediaExtensions';
import { useFormField, useMergeRefs } from '../FormContext';
import createSuggestion from './suggestion';
import { DetailsExtension } from './DetailsExtension';
import Toolbar from './Toolbar';
import { htmlToMarkdown, markdownToHtml } from './markdownUtils';
import s from './FormWYSIWYG.css';

/**
 * FormWYSIWYG — A rich-text editor field powered by Tiptap.
 *
 * It integrates with `react-hook-form` automatically via `useFormField` and
 * `useController`.  The component supports placeholder text, disabled state,
 * and `@mention` auto-complete out of the box.
 *
 * @param {Object} props
 * @param {string}   [props.className]       Additional CSS class
 * @param {boolean}  [props.disabled]        Disable editing
 * @param {string}   [props.placeholder]     Placeholder text
 * @param {Function} [props.onChange]         Callback fired on content change
 * @param {(query: string) => Promise<string[]>} [props.onMentionQuery]
 *   Async callback to search for mentionable items.
 *   Receives the text typed after `@` and must return a promise resolving
 *   to an array of label strings.
 *   Example (static):  `(query) => Promise.resolve(['Alice', 'Bob'])`
 *   Example (async):   `(query) => fetch('/api/users?q=' + query).then(r => r.json())`
 */
const FormWYSIWYG = forwardRef(function FormWYSIWYG$(
  { className, disabled, placeholder, onChange: onChangeProp, onMentionQuery },
  forwardedRef,
) {
  const { id, name, error } = useFormField();
  const {
    field: { onChange, onBlur, value, ref: registerRef },
  } = useController({ name });

  const [isFullScreen, setIsFullScreen] = useState(false);
  const toggleFullScreen = useCallback(
    () => setIsFullScreen(prev => !prev),
    [],
  );

  useEffect(() => {
    const handleKeyDown = e => {
      if (e.key === 'Escape' && isFullScreen) {
        setIsFullScreen(false);
      }
    };

    if (isFullScreen) {
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullScreen]);

  const handleRef = useMergeRefs(registerRef, forwardedRef);

  // Track whether the editor's own onUpdate caused the latest value change.
  // This prevents a feedback loop: type → onUpdate → value changes → useEffect
  // → setContent → onUpdate → …
  const isInternalUpdate = useRef(false);

  // Stable handler that chains both react-hook-form's onChange and the optional
  // consumer-supplied onChange prop.
  const handleChange = useCallback(
    html => {
      onChange(html);
      if (onChangeProp) {
        onChangeProp(html);
      }
    },
    [onChange, onChangeProp],
  );

  // Build the mention suggestion config from the consumer callback.
  // Only include the Mention extension when a query callback is provided.
  const extensions = useMemo(() => {
    const exts = [
      StarterKit.configure({
        // We add Link and Underline separately with custom options
        link: false,
        underline: false,
      }),
      Underline,
      Placeholder.configure({ placeholder }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      DetailsExtension,
      Link.configure({
        openOnClick: false,
        autolink: true,
      }),
      Image.configure({
        inline: true,
      }),
      Youtube.configure({
        inline: false,
      }),
      Video,
      Audio,
    ];

    if (onMentionQuery) {
      exts.push(
        Mention.configure({
          HTMLAttributes: { class: 'mention' },
          suggestion: createSuggestion(onMentionQuery),
        }),
      );
    }

    return exts;
  }, [placeholder, onMentionQuery]);

  const editor = useEditor({
    extensions,
    content: markdownToHtml(value || ''),
    editable: !disabled,
    onUpdate: ({ editor: e }) => {
      isInternalUpdate.current = true;
      handleChange(htmlToMarkdown(e.getHTML()));
    },
    onBlur: () => {
      onBlur();
    },
  });

  // Keep the `editable` flag in sync when `disabled` prop changes at runtime.
  useEffect(() => {
    if (editor) {
      editor.setEditable(!disabled);
    }
  }, [editor, disabled]);

  // Sync external value changes (markdown) into the editor (HTML).
  // Only runs for programmatic changes (form reset, setValue) — not for
  // the user's own keystrokes, which are tracked via isInternalUpdate.
  useEffect(() => {
    if (!editor || value === undefined) return;

    // Skip if this value change originated from our own onUpdate handler
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }

    editor.commands.setContent(markdownToHtml(value), false);
  }, [editor, value]);

  // Expose a pseudo-imperative API so that consumers can programmatically
  // focus the editor or access the underlying Tiptap instance.
  useImperativeHandle(forwardedRef, () => ({
    focus: () => {
      if (editor) {
        editor.commands.focus();
      }
    },
    getEditor: () => editor,
  }));

  return (
    <div
      className={clsx(
        s.wysiwygWrapper,
        {
          [s.wysiwygError]: error,
          [s.wysiwygDisabled]: disabled,
          [s.wysiwygFullScreen]: isFullScreen,
        },
        className,
      )}
      ref={handleRef}
      id={id}
    >
      <Toolbar
        editor={editor}
        isFullScreen={isFullScreen}
        onToggleFullScreen={toggleFullScreen}
      />
      <div className={s.editorContent}>
        <EditorContent editor={editor} className={s.contentEditable} />
      </div>
    </div>
  );
});

FormWYSIWYG.propTypes = {
  className: PropTypes.string,
  disabled: PropTypes.bool,
  placeholder: PropTypes.string,
  onChange: PropTypes.func,
  onMentionQuery: PropTypes.func,
};

export default FormWYSIWYG;
