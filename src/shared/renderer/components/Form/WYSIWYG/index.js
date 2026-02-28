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
import { useTranslation } from 'react-i18next';
import { useController } from 'react-hook-form';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus'; // eslint-disable-line import/no-unresolved
import DragHandle from '@tiptap/extension-drag-handle-react';
import StarterKit from '@tiptap/starter-kit';
import Mention from '@tiptap/extension-mention';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { TableKit } from '@tiptap/extension-table';
import { Link } from '@tiptap/extension-link';
import { Youtube } from '@tiptap/extension-youtube';
import { Image as TiptapImage } from '@tiptap/extension-image';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import { Selection } from '@tiptap/extensions';
import { useFormField, useMergeRefs } from '../FormContext';
import createSuggestion from './suggestion';
import { DetailsExtension } from './DetailsExtension';
import { Video, Audio } from './MediaExtensions';
import { Emoji } from './EmojiExtension';
import { FontSize } from './FontSizeExtension';
import { CommentExtension } from './CommentExtension';
import CommentActionsPopup from './CommentActionsPopup';
import Toolbar from './Toolbar';
import ToolbarButton from './ToolbarButton';
import Icons from './ToolbarIcon';
import { htmlToMarkdown, markdownToHtml } from './markdownUtils';
import s from './FormWYSIWYG.css';

// Lightweight check: does the string contain common markdown syntax?
const MD_PATTERNS =
  /^\s*(#{1,6}\s|>\s|[-*+]\s|\d+\.\s|- \[[ x]\]|\*{1,3}|_{1,3}|~{2}|```|!\[|\[.*\]\()/m;

// ---------------------------------------------------------------------------
// Custom Extensions
// ---------------------------------------------------------------------------

// Extend the default Image extension to fix a bug where ResizableNodeView
// gets stuck with pointerEvents: 'none' if the image loads from cache instantly.
const CustomImage = TiptapImage.extend({
  addNodeView() {
    const parentNodeView =
      typeof this.parent === 'function' ? this.parent() : null;
    if (!parentNodeView) return null;

    return props => {
      const view = parentNodeView(props);
      if (view && view.dom) {
        const img = view.dom.querySelector('img');
        if (img) {
          // If the image is already downloaded/cached, unblock immediately
          if (img.complete) {
            view.dom.style.visibility = '';
            view.dom.style.pointerEvents = '';
          } else {
            // Otherwise bind the event safely
            img.addEventListener('load', () => {
              view.dom.style.visibility = '';
              view.dom.style.pointerEvents = '';
            });
          }
        }
      }
      return view;
    };
  },
});

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
 * @param {Array}    [props.addExtensions]     Custom Tiptap extensions to add
 * @param {string[]} [props.excludeExtensions]  Array of extension names to exclude (e.g. `['youtube', 'video']`)
 * @param {Object}   [props.editorProps]        Custom ProseMirror editorProps to merge
 */
const FormWYSIWYG = forwardRef(function FormWYSIWYG$(
  {
    className,
    disabled,
    placeholder,
    onChange: onChangeProp,
    onMentionQuery,
    addExtensions = [],
    excludeExtensions = [],
    editorProps: userEditorProps,
  },
  forwardedRef,
) {
  const { t } = useTranslation();
  const { handlePaste, transformPastedHTML, ...restUserEditorProps } =
    userEditorProps || {};
  const { id, name, error } = useFormField();
  const {
    field: { onChange, onBlur, value, ref: registerRef },
  } = useController({ name });

  // Store comments local state: { [commentId]: [{ id, text, createdAt }] }
  const [commentsState, setCommentsState] = useState({});
  const [activeCommentId, setActiveCommentId] = useState(null);

  // Parse comments from the active mark attribute when selected
  const handleCommentActivated = useCallback((id, commentsJson) => {
    setActiveCommentId(id);
    if (id && commentsJson) {
      try {
        const parsed = JSON.parse(commentsJson);
        setCommentsState(prev => ({ ...prev, [id]: parsed }));
      } catch (e) {
        // ignore parsing errors
      }
    }
  }, []);

  // Controls whether the popup form is open for the current selection
  const [isCommentPopupOpen, setIsCommentPopupOpen] = useState(false);

  // Called when the user clicks the "Add Comment" button in BubbleMenu
  const handleOpenCommentPopup = useCallback(() => {
    setIsCommentPopupOpen(true);
  }, []);

  // Called when the user clicks Cancel or Escape in the popup
  const handleCloseCommentPopup = useCallback(() => {
    setIsCommentPopupOpen(false);
  }, []);

  // When selection changes and a different comment becomes active,
  // we reset the popup open state so it doesn't stay open unexpectedly
  useEffect(() => {
    setIsCommentPopupOpen(false);
  }, [activeCommentId]);

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

  // Ref to pass markdown text from handlePaste to transformPastedHTML without
  // relying on the deprecated window.event API.
  const markdownPasteRef = useRef(null);

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
      StarterKit.configure({ link: false, underline: false }),
      Underline,
      Placeholder.configure({ placeholder }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TableKit.configure({ table: { resizable: true } }),
      DetailsExtension,
      Link.configure({ openOnClick: false, autolink: true }),
      Emoji,
      CustomImage.configure({
        inline: true,
        allowBase64: true,
        resize: { enabled: true, alwaysPreserveAspectRatio: true },
      }),
      Youtube.configure({ inline: false }),
      Video,
      Audio,
      Color,
      TextStyle,
      FontSize,
      Highlight.configure({ multicolor: true }),
      Selection,
      CommentExtension.configure({
        onCommentActivated: handleCommentActivated,
      }),
    ];

    if (typeof onMentionQuery === 'function') {
      exts.push(
        Mention.configure({
          HTMLAttributes: { class: 'mention' },
          suggestion: createSuggestion(onMentionQuery),
        }),
      );
    }

    if (addExtensions && addExtensions.length > 0) {
      exts.push(...addExtensions);
    }

    // Filter out built-in extensions that the consumer wants to exclude
    if (excludeExtensions && excludeExtensions.length > 0) {
      return exts.filter(ext => !excludeExtensions.includes(ext.name));
    }

    return exts;
  }, [
    placeholder,
    onMentionQuery,
    addExtensions,
    excludeExtensions,
    handleCommentActivated,
  ]);

  const editor = useEditor({
    extensions,
    content: markdownToHtml(value || ''),
    editable: !disabled,
    editorProps: {
      ...restUserEditorProps,
      handlePaste: (view, event, slice) => {
        const { clipboardData } = event;
        if (!clipboardData) {
          return typeof handlePaste === 'function'
            ? handlePaste(view, event, slice)
            : false;
        }

        // Helper: insert an image node at the current cursor position
        const insertImage = src => {
          const { state } = view;
          const node = state.schema.nodes.image.create({ src });
          const tr = state.tr.replaceSelectionWith(node);
          view.dispatch(tr);
        };

        // 1. Handle actual image files (e.g., copied from a local file or screenshot)
        const items = Array.from(clipboardData.items);
        for (const item of items) {
          if (item.type.indexOf('image') === 0) {
            const file = item.getAsFile();
            if (file) {
              const reader = new FileReader();
              reader.onload = e => {
                insertImage(e.target.result);
              };
              reader.readAsDataURL(file);
              return true; // Stop default paste
            }
          }
        }

        // 2. Handle pasted plain text that looks like Markdown
        const text = clipboardData.getData('text/plain');
        if (text) {
          const trimmed = text.trim();

          // 2a. Raw base64 image data URI
          if (
            trimmed.startsWith('data:image/') &&
            trimmed.includes(';base64,')
          ) {
            insertImage(trimmed);
            return true;
          }

          // 2b. Markdown syntax detected — parse and insert as rich content.
          //     Only if there is NO HTML version on the clipboard (which means
          //     the user is pasting from a code editor or plain text source).
          const hasHtml = clipboardData.types.includes('text/html');
          if (!hasHtml && MD_PATTERNS.test(trimmed)) {
            // Store the markdown in a ref so transformPastedHTML can pick it up.
            markdownPasteRef.current = trimmed;
            return false; // Let ProseMirror continue so it calls transformPastedHTML
          }
        }

        // Delegate to consumer's handlePaste if our logic didn't handle it
        if (typeof handlePaste === 'function') {
          return handlePaste(view, event, slice);
        }

        return false; // Let ProseMirror handle everything else
      },
      transformPastedHTML: html => {
        // If handlePaste flagged this paste as Markdown, replace the clipboard
        // HTML with our parsed version so ProseMirror routes it through its
        // standard HTML parser with correct block context.
        const md = markdownPasteRef.current;
        if (md) {
          markdownPasteRef.current = null;
          return markdownToHtml(md);
        }
        return typeof transformPastedHTML === 'function'
          ? transformPastedHTML(html)
          : html;
      },
    },
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

  const handleAddComment = useCallback(
    text => {
      // If we don't have an active comment ID for this text range yet,
      // create a new comment mark around it.
      let currentId = activeCommentId;
      if (!currentId) {
        currentId = `comment-${Date.now()}`;
      }

      const newComment = {
        id: `c-${Date.now()}`,
        text,
        createdAt: new Date().toISOString(),
      };

      const existingComments = activeCommentId
        ? commentsState[activeCommentId] || []
        : [];
      const updatedComments = [...existingComments, newComment];
      const commentsJson = JSON.stringify(updatedComments);

      // Save the comments back to the editor node's HTML attributes
      if (!activeCommentId) {
        editor.commands.setComment(currentId, commentsJson);
      } else {
        editor.commands.updateComment(currentId, commentsJson);
      }

      setCommentsState(prev => ({
        ...prev,
        [currentId]: updatedComments,
      }));

      // Keep popup open to see the thread? Or close it. Let's close it after submit.
      setIsCommentPopupOpen(false);

      // Return focus to editor
      editor.commands.focus();
    },
    [editor, activeCommentId, commentsState],
  );

  const handleRemoveCommentItem = useCallback(
    commentItemId => {
      if (!activeCommentId) return;

      setCommentsState(prev => {
        const thread = prev[activeCommentId] || [];
        const newThread = thread.filter(c => c.id !== commentItemId);

        // If thread is empty after removing this item, automatically unset the mark
        if (newThread.length === 0) {
          editor.commands.unsetComment(activeCommentId);
          const newState = { ...prev };
          delete newState[activeCommentId];
          return newState;
        }

        // Otherwise update the markdown string inside the editor
        editor.commands.updateComment(
          activeCommentId,
          JSON.stringify(newThread),
        );

        return {
          ...prev,
          [activeCommentId]: newThread,
        };
      });
    },
    [editor, activeCommentId],
  );

  // Called when the user actively wants to *delete* the entire comment thread
  // from the text (e.g. clicking the toolbar button again when a comment is active)
  const handleRemoveWholeComment = useCallback(() => {
    if (activeCommentId) {
      editor.commands.unsetComment(activeCommentId);
      setCommentsState(prev => {
        const next = { ...prev };
        delete next[activeCommentId];
        return next;
      });
      setIsCommentPopupOpen(false);
    }
  }, [editor, activeCommentId]);

  // Patch the ProseMirror view to suppress the 'localsInner' decoration
  // error that occurs when the DragHandle and column-resize plugins
  // conflict during drag-and-drop near tables.
  useEffect(() => {
    if (!editor || !editor.view) return;
    const { view } = editor;
    const origDispatch = view.dispatch.bind(view);
    view.dispatch = (...args) => {
      try {
        origDispatch(...args);
      } catch (err) {
        console.log(err);

        // Only throw error in development mode
        if (__DEV__) {
          throw err;
        }
      }
    };
  }, [editor]);

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
        excludeExtensions={excludeExtensions}
      />
      <div className={s.editorContent}>
        {editor && (
          <>
            <DragHandle editor={editor}>
              <div className={s.dragHandle}>{Icons.dragHandle}</div>
            </DragHandle>

            <BubbleMenu
              className={s.bubbleMenu}
              editor={editor}
              appendTo={() =>
                typeof document !== 'undefined' ? document.body : null
              }
              shouldShow={({ editor: e, state }) => {
                const { selection } = state;
                const { empty } = selection;
                const hasEditorFocus = e.isFocused;

                if (!hasEditorFocus || empty) {
                  return false;
                }
                return true;
              }}
            >
              {isCommentPopupOpen ? (
                <CommentActionsPopup
                  comments={
                    activeCommentId ? commentsState[activeCommentId] || [] : []
                  }
                  onAddComment={handleAddComment}
                  onRemoveComment={handleRemoveCommentItem}
                  onClose={handleCloseCommentPopup}
                />
              ) : (
                <>
                  <ToolbarButton
                    icon={Icons.comment}
                    label={
                      activeCommentId
                        ? t(
                            'shared.form.wysiwyg.viewAndReplyComment',
                            'View & Reply Comment',
                          )
                        : t('shared.form.wysiwyg.addComment', 'Add Comment')
                    }
                    title={
                      activeCommentId
                        ? t(
                            'shared.form.wysiwyg.viewAndReplyComment',
                            'View & Reply Comment',
                          )
                        : t('shared.form.wysiwyg.addComment', 'Add Comment')
                    }
                    onClick={handleOpenCommentPopup}
                    isActive={!!activeCommentId}
                  />

                  {/* If we are actively on a comment thread and not in popup mode, show a quick delete button */}
                  {activeCommentId && (
                    <ToolbarButton
                      icon={Icons.tableDelete} // Using tableDelete icon as a generic trash icon for now
                      label={t(
                        'shared.form.wysiwyg.removeCommentThread',
                        'Remove Comment Thread',
                      )}
                      title={t(
                        'shared.form.wysiwyg.removeCommentThread',
                        'Remove Comment Thread',
                      )}
                      onClick={handleRemoveWholeComment}
                    />
                  )}
                </>
              )}
            </BubbleMenu>
          </>
        )}
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
  addExtensions: PropTypes.array,
  excludeExtensions: PropTypes.arrayOf(PropTypes.string),
  editorProps: PropTypes.object,
};

export default FormWYSIWYG;
