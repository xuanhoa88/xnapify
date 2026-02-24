/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import ToolbarButton from './ToolbarButton';
import Icons from './ToolbarIcon';
import s from './TableActionsPopup.css';

/**
 * TableActionsPopup — A toolbar button that opens a popover with table
 * editing actions (add/delete rows/columns, merge/split, toggle headers,
 * delete table).
 *
 * @param {Object} props
 * @param {import('@tiptap/react').Editor} props.editor  Tiptap editor instance
 * @param {boolean}  [props.disabled]                    Disable the trigger button
 */
export default function TableActionsPopup({ editor, disabled }) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const run = command => {
    command();
    setIsOpen(false);
  };

  const actionItem = (icon, label, command, opts = {}) => (
    <button
      key={label}
      type='button'
      className={`${s.actionItem}${opts.danger ? ` ${s.danger}` : ''}`}
      onClick={() => run(command)}
      disabled={opts.disabled}
    >
      <span className={s.actionIcon}>{icon}</span>
      {label}
    </button>
  );

  return (
    <div className={s.container} ref={containerRef}>
      <ToolbarButton
        icon={Icons.table}
        title={t('shared:form.wysiwyg.tableActions', 'Table Actions')}
        isActive={isOpen || editor.isActive('table')}
        onClick={() => setIsOpen(prev => !prev)}
        disabled={disabled}
      />

      {isOpen && (
        <div className={s.popover}>
          {/* Insert */}
          {actionItem(
            Icons.table,
            t('shared:form.wysiwyg.tableInsert', 'Insert Table'),
            () =>
              editor
                .chain()
                .focus()
                .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                .run(),
          )}

          {editor.isActive('table') && (
            <>
              <div className={s.divider} />

              {/* Row actions */}
              {actionItem(
                Icons.tableAddRowBefore,
                t('shared:form.wysiwyg.tableRowBefore', 'Add Row Before'),
                () => editor.chain().focus().addRowBefore().run(),
              )}
              {actionItem(
                Icons.tableRow,
                t('shared:form.wysiwyg.tableRowAfter', 'Add Row After'),
                () => editor.chain().focus().addRowAfter().run(),
              )}
              {actionItem(
                Icons.tableDeleteRow,
                t('shared:form.wysiwyg.tableDeleteRow', 'Delete Row'),
                () => editor.chain().focus().deleteRow().run(),
                { danger: true },
              )}

              <div className={s.divider} />

              {/* Column actions */}
              {actionItem(
                Icons.tableAddColBefore,
                t('shared:form.wysiwyg.tableColBefore', 'Add Column Before'),
                () => editor.chain().focus().addColumnBefore().run(),
              )}
              {actionItem(
                Icons.tableCol,
                t('shared:form.wysiwyg.tableColAfter', 'Add Column After'),
                () => editor.chain().focus().addColumnAfter().run(),
              )}
              {actionItem(
                Icons.tableDeleteCol,
                t('shared:form.wysiwyg.tableDeleteCol', 'Delete Column'),
                () => editor.chain().focus().deleteColumn().run(),
                { danger: true },
              )}

              <div className={s.divider} />

              {/* Cell & header actions */}
              {actionItem(
                Icons.tableMergeOrSplit,
                t('shared:form.wysiwyg.tableMergeOrSplit', 'Merge/Split Cells'),
                () => editor.chain().focus().mergeOrSplit().run(),
              )}
              {actionItem(
                Icons.tableToggleHeader,
                t(
                  'shared:form.wysiwyg.tableToggleHeaderRow',
                  'Toggle Header Row',
                ),
                () => editor.chain().focus().toggleHeaderRow().run(),
              )}
              {actionItem(
                Icons.tableToggleHeader,
                t(
                  'shared:form.wysiwyg.tableToggleHeaderCol',
                  'Toggle Header Column',
                ),
                () => editor.chain().focus().toggleHeaderColumn().run(),
              )}

              <div className={s.divider} />

              {/* Delete table */}
              {actionItem(
                Icons.tableDelete,
                t('shared:form.wysiwyg.tableDelete', 'Delete Table'),
                () => editor.chain().focus().deleteTable().run(),
                { danger: true },
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

TableActionsPopup.propTypes = {
  editor: PropTypes.object.isRequired,
  disabled: PropTypes.bool,
};
