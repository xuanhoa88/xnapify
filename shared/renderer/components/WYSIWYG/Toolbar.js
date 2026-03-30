/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useCallback, useState, useEffect, useRef } from 'react';

import clsx from 'clsx';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import ExtensionSlot from '@shared/extension/client/ExtensionSlot';

import CodeBlockActionsPopup from './CodeBlockActionsPopup';
import ColorPickerPopup from './ColorPickerPopup';
import EmojiPickerButton from './EmojiPickerButton';
import MediaActionsPopup from './MediaActionsPopup';
import TableActionsPopup from './TableActionsPopup';
import ToolbarButton from './ToolbarButton';
import Icons from './ToolbarIcon';
import { useToolbarPrompt } from './ToolbarPromptModal';

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
 * @param {string[]} [props.excludeExtensions]
 * @param {Function} [props.toolbarAppend]
 */
export default function Toolbar({
  editor,
  isFullScreen,
  onToggleFullScreen,
  excludeExtensions = [],
  toolbarAppend,
  languages = [],
  toolbarPlacement = 'bottom',
}) {
  const tooltipSide = toolbarPlacement === 'top' ? 'below' : 'above';
  // Quick lookup: is a given extension enabled?
  const has = useCallback(
    name => !excludeExtensions.includes(name),
    [excludeExtensions],
  );
  const { t } = useTranslation();
  const { openPrompt } = useToolbarPrompt();
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

  // --- Font-size input: local state so typing doesn't steal focus --------
  const fontSizeRef = useRef(null);
  const [fontSizeValue, setFontSizeValue] = useState('16');

  // Sync editor → local state whenever the selection / attributes change,
  // but only when the input is NOT focused (i.e. the user is not editing).
  useEffect(() => {
    if (!editor) return undefined;

    const sync = () => {
      if (document.activeElement === fontSizeRef.current) return;
      const fs = editor.getAttributes('textStyle').fontSize;
      setFontSizeValue(fs ? String(parseInt(fs, 10)) : '16');
    };

    editor.on('selectionUpdate', sync);
    editor.on('transaction', sync);
    return () => {
      editor.off('selectionUpdate', sync);
      editor.off('transaction', sync);
    };
  }, [editor]);

  const applyFontSize = useCallback(
    val => {
      if (!editor) return;
      if (val && Number(val) > 0) {
        editor.chain().focus().setFontSize(`${val}px`).run();
      } else {
        editor.chain().focus().unsetFontSize().run();
      }
    },
    [editor],
  );

  if (!editor) return null;

  return (
    <div
      className={clsx(s.toolbar, {
        [s.toolbarTop]: toolbarPlacement === 'top',
        [s.toolbarBottom]: toolbarPlacement === 'bottom',
      })}
      role='toolbar'
      aria-label='Formatting'
      data-tooltip-position={tooltipSide}
    >
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
        {has('underline') &&
          btn(
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
        {has('taskList') &&
          btn(
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
        {has('details') &&
          btn(
            'details',
            t('shared:form.wysiwyg.details', 'Collapsible Details'),
            () => editor.chain().focus().setDetails().run(),
            'details',
          )}
      </div>

      <div className={s.toolbarDivider} />

      {/* Table tools */}
      {has('table') && (
        <div className={s.toolbarGroup}>
          <TableActionsPopup
            editor={editor}
            disabled={!editor.can().chain().focus().run()}
          />
        </div>
      )}

      <div className={s.toolbarDivider} />

      {/* Formatting & Color Group */}
      <div className={s.toolbarGroup}>
        {has('color') && (
          <ColorPickerPopup
            icon={Icons.textColor}
            title={t('shared:form.wysiwyg.textColor', 'Text Color')}
            value={editor.getAttributes('textStyle').color}
            defaultValue='#000000'
            isActive={!!editor.getAttributes('textStyle').color}
            onChange={color => editor.chain().focus().setColor(color).run()}
            onReset={() => editor.chain().focus().unsetColor().run()}
            resetLabel={t('shared:form.wysiwyg.resetTextColor', 'Reset')}
            disabled={!editor.can().chain().focus().run()}
          />
        )}
        {has('highlight') && (
          <ColorPickerPopup
            icon={Icons.highlight}
            title={t('shared:form.wysiwyg.highlight', 'Background Color')}
            value={editor.getAttributes('highlight').color}
            defaultValue='#ffffff'
            isActive={editor.isActive('highlight')}
            onChange={color =>
              editor.chain().focus().toggleHighlight({ color }).run()
            }
            onReset={() => editor.chain().focus().unsetHighlight().run()}
            resetLabel={t('shared:form.wysiwyg.resetHighlight', 'Reset')}
            disabled={!editor.can().chain().focus().run()}
          />
        )}
        {has('fontSize') && (
          <div
            className={s.fontSizeWrapper}
            data-tooltip={t('shared:form.wysiwyg.fontSize', 'Font Size (px)')}
          >
            <input
              ref={fontSizeRef}
              type='number'
              className={s.fontSizeInput}
              value={fontSizeValue}
              onChange={e => setFontSizeValue(e.target.value)}
              onBlur={e => applyFontSize(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  applyFontSize(e.target.value);
                }
              }}
              min='8'
              max='100'
            />
          </div>
        )}
      </div>

      <div className={s.toolbarDivider} />

      {/* Links & Media Group */}
      <div className={s.toolbarGroup}>
        {has('link') && (
          <>
            {btn(
              'link',
              t('shared:form.wysiwyg.link', 'Add Link'),
              () => {
                const previousUrl = editor.getAttributes('link').href;
                openPrompt({
                  title: t('shared:form.wysiwyg.link', 'Add Link'),
                  label: 'URL',
                  defaultValue: previousUrl || '',
                  slotName: 'wysiwyg.prompt.link',
                  onSubmit: url => {
                    if (!url) {
                      editor
                        .chain()
                        .focus()
                        .extendMarkRange('link')
                        .unsetLink()
                        .run();
                      return;
                    }
                    editor
                      .chain()
                      .focus()
                      .extendMarkRange('link')
                      .setLink({ href: url })
                      .run();
                  },
                });
              },
              'link',
            )}
            {editor.isActive('link') &&
              btn(
                'unlink',
                t('shared:form.wysiwyg.unlink', 'Remove Link'),
                () => editor.chain().focus().unsetLink().run(),
              )}
          </>
        )}

        {has('image') &&
          btn('image', t('shared:form.wysiwyg.image', 'Image'), () => {
            openPrompt({
              title: t('shared:form.wysiwyg.image', 'Image'),
              label: t('shared:form.wysiwyg.imageUrl', 'Image URL'),
              slotName: 'wysiwyg.prompt.image',
              onSubmit: url => {
                if (url) editor.chain().focus().setImage({ src: url }).run();
              },
            });
          })}
        {(has('video') || has('audio') || has('youtube')) && (
          <MediaActionsPopup
            editor={editor}
            disabled={!editor.can().chain().focus().run()}
            hasVideo={has('video')}
            hasAudio={has('audio')}
            hasYoutube={has('youtube')}
            openPrompt={openPrompt}
          />
        )}
        {has('emoji') && (
          <EmojiPickerButton
            title={t('shared:form.wysiwyg.emoji', 'Emoji')}
            onSelect={emoji =>
              editor.chain().focus().insertContent(emoji).run()
            }
            disabled={!editor.can().chain().focus().run()}
          />
        )}
      </div>

      <div className={s.toolbarDivider} />

      {/* Code, Math & rule */}
      <div className={s.toolbarGroup}>
        {has('codeBlock') && (
          <CodeBlockActionsPopup
            editor={editor}
            disabled={!editor.can().chain().focus().run()}
            languages={languages}
          />
        )}
        {has('mathematics') &&
          btn(
            'inlineMath',
            t('shared:form.wysiwyg.math', 'Math'),
            () => {
              openPrompt({
                title: t('shared:form.wysiwyg.math', 'Math'),
                label: t(
                  'shared:form.wysiwyg.enterLatex',
                  'Enter LaTeX expression',
                ),
                slotName: 'wysiwyg.prompt.math',
                onSubmit: latex => {
                  if (!latex) return;
                  const { $from } = editor.state.selection;
                  const isEmptyBlock =
                    $from.parent.isTextblock && $from.parent.content.size === 0;
                  if (isEmptyBlock) {
                    editor.chain().focus().insertBlockMath({ latex }).run();
                  } else {
                    editor.chain().focus().insertInlineMath({ latex }).run();
                  }
                },
              });
            },
            'inlineMath',
          )}
        {btn(
          'horizontalRule',
          t('shared:form.wysiwyg.horizontalRule', 'Horizontal rule'),
          () => editor.chain().focus().setHorizontalRule().run(),
        )}
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

      {toolbarAppend && (
        <>
          <div className={s.toolbarDivider} />
          <div className={s.toolbarGroup}>{toolbarAppend(editor)}</div>
        </>
      )}

      {/* Extensions */}
      <ExtensionSlot name='wysiwyg.toolbar' editor={editor} />

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
  excludeExtensions: PropTypes.arrayOf(PropTypes.string),
  toolbarAppend: PropTypes.func,
  languages: PropTypes.arrayOf(PropTypes.string),
  toolbarPlacement: PropTypes.oneOf(['top', 'bottom']),
};
