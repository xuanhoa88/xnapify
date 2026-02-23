/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useCallback } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import EmojiPickerButton from './EmojiPickerButton';
import ToolbarButton from './ToolbarButton';
import Icons from './ToolbarIcon';
import s from './Toolbar.css';

/**
 * Toolbar — Formatting toolbar for the Tiptap WYSIWYG editor.
 *
 * Renders a horizontal bar of formatting buttons that call editor commands.
 * The buttons reflect the current selection state (active/inactive).
 *
 * @param {Object} props
 * @param {import('@tiptap/react').Editor | null} props.editor
 * @param {boolean} [props.isFullScreen]
 * @param {Function} [props.onToggleFullScreen]
 */
export default function Toolbar({ editor, isFullScreen, onToggleFullScreen }) {
  const { t } = useTranslation();
  const btn = useCallback(
    (key, title, command, activeCheck) => (
      <ToolbarButton
        key={key}
        icon={Icons[key]}
        title={title}
        isActive={activeCheck ? editor.isActive(activeCheck) : false}
        onClick={() => command()}
        disabled={!editor.can().chain().focus().run()}
      />
    ),
    [editor],
  );

  if (!editor) return null;

  return (
    <div className={s.toolbar} role='toolbar' aria-label='Formatting'>
      {/* Text formatting */}
      <div className={s.toolbarGroup}>
        {btn(
          'bold',
          t('shared:form.wysiwyg.bold', 'Bold'),
          () => editor.chain().focus().toggleBold().run(),
          'bold',
        )}
        {btn(
          'italic',
          t('shared:form.wysiwyg.italic', 'Italic'),
          () => editor.chain().focus().toggleItalic().run(),
          'italic',
        )}
        {btn(
          'underline',
          t('shared:form.wysiwyg.underline', 'Underline'),
          () => editor.chain().focus().toggleUnderline().run(),
          'underline',
        )}
        {btn(
          'strikethrough',
          t('shared:form.wysiwyg.strikethrough', 'Strikethrough'),
          () => editor.chain().focus().toggleStrike().run(),
          'strike',
        )}
      </div>

      <div className={s.toolbarDivider} />

      {/* Block formatting */}
      <div className={s.toolbarGroup}>
        {btn(
          'bulletList',
          t('shared:form.wysiwyg.bulletList', 'Bullet list'),
          () => editor.chain().focus().toggleBulletList().run(),
          'bulletList',
        )}
        {btn(
          'orderedList',
          t('shared:form.wysiwyg.orderedList', 'Numbered list'),
          () => editor.chain().focus().toggleOrderedList().run(),
          'orderedList',
        )}
        {btn(
          'taskList',
          t('shared:form.wysiwyg.taskList', 'Task list'),
          () => editor.chain().focus().toggleTaskList().run(),
          'taskList',
        )}
        {btn(
          'blockquote',
          t('shared:form.wysiwyg.blockquote', 'Blockquote'),
          () => editor.chain().focus().toggleBlockquote().run(),
          'blockquote',
        )}
        {btn(
          'details',
          t('shared:form.wysiwyg.details', 'Collapsible Details'),
          () => editor.chain().focus().setDetails().run(),
          'details',
        )}
      </div>

      <div className={s.toolbarDivider} />

      {/* Table tools */}
      <div className={s.toolbarGroup}>
        {btn(
          'table',
          t('shared:form.wysiwyg.table', 'Insert Table'),
          () =>
            editor
              .chain()
              .focus()
              .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
              .run(),
          'table',
        )}
        {editor.isActive('table') && (
          <>
            {btn(
              'tableRow',
              t('shared:form.wysiwyg.tableRow', 'Add Row After'),
              () => editor.chain().focus().addRowAfter().run(),
            )}
            {btn(
              'tableCol',
              t('shared:form.wysiwyg.tableCol', 'Add Column After'),
              () => editor.chain().focus().addColumnAfter().run(),
            )}
            {btn(
              'tableDelete',
              t('shared:form.wysiwyg.tableDelete', 'Delete Table'),
              () => editor.chain().focus().deleteTable().run(),
            )}
          </>
        )}
      </div>

      <div className={s.toolbarDivider} />

      {/* Inline code & rule */}
      <div className={s.toolbarGroup}>
        {btn(
          'code',
          t('shared:form.wysiwyg.code', 'Code'),
          () => editor.chain().focus().toggleCode().run(),
          'code',
        )}
        {btn(
          'horizontalRule',
          t('shared:form.wysiwyg.horizontalRule', 'Horizontal rule'),
          () => editor.chain().focus().setHorizontalRule().run(),
        )}
      </div>

      <div className={s.toolbarDivider} />

      {/* Links & Media Group */}
      <div className={s.toolbarGroup}>
        {btn(
          'link',
          t('shared:form.wysiwyg.link', 'Add Link'),
          () => {
            const previousUrl = editor.getAttributes('link').href;
            const url = window.prompt('URL', previousUrl || '');

            // cancelled
            if (url == null) {
              return;
            }

            // empty
            if (url.trim().length === 0) {
              editor.chain().focus().extendMarkRange('link').unsetLink().run();
              return;
            }

            // update link
            editor
              .chain()
              .focus()
              .extendMarkRange('link')
              .setLink({ href: url })
              .run();
          },
          'link',
        )}
        {editor.isActive('link') &&
          btn('unlink', t('shared:form.wysiwyg.unlink', 'Remove Link'), () =>
            editor.chain().focus().unsetLink().run(),
          )}

        {btn('image', t('shared:form.wysiwyg.image', 'Image'), () => {
          const url = window.prompt('Image URL');
          if (url) editor.chain().focus().setImage({ src: url }).run();
        })}
        {btn('video', t('shared:form.wysiwyg.video', 'Video'), () => {
          const url = window.prompt('Video URL (MP4, WebM, etc.)');
          if (url) editor.chain().focus().setVideo({ src: url }).run();
        })}
        {btn('audio', t('shared:form.wysiwyg.audio', 'Audio'), () => {
          const url = window.prompt('Audio URL (MP3, WAV, etc.)');
          if (url) editor.chain().focus().setAudio({ src: url }).run();
        })}
        {btn('youtube', t('shared:form.wysiwyg.youtube', 'YouTube'), () => {
          const url = window.prompt('YouTube Video URL');
          if (url) editor.chain().focus().setYoutubeVideo({ src: url }).run();
        })}
        <EmojiPickerButton
          title={t('shared:form.wysiwyg.emoji', 'Emoji')}
          onSelect={emoji => editor.chain().focus().insertContent(emoji).run()}
          disabled={!editor.can().chain().focus().run()}
        />
      </div>

      <div className={s.toolbarDivider} />

      {/* Undo / Redo */}
      <div className={s.toolbarGroup}>
        <ToolbarButton
          icon={Icons.undo}
          title={t('shared:form.wysiwyg.undo', 'Undo')}
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
        />
        <ToolbarButton
          icon={Icons.redo}
          title={t('shared:form.wysiwyg.redo', 'Redo')}
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
        />
      </div>
      {/* View Options */}
      <div className={s.toolbarGroup}>
        <ToolbarButton
          icon={isFullScreen ? Icons.minimize : Icons.fullscreen}
          title={
            isFullScreen
              ? t('shared:form.wysiwyg.exitFullScreen', 'Exit full screen')
              : t('shared:form.wysiwyg.fullScreen', 'Full screen')
          }
          onClick={onToggleFullScreen}
          isActive={isFullScreen}
        />
      </div>
    </div>
  );
}

Toolbar.propTypes = {
  editor: PropTypes.object,
  isFullScreen: PropTypes.bool,
  onToggleFullScreen: PropTypes.func,
};
