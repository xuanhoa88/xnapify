/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import ContextMenu from '../ContextMenu';

import ToolbarButton from './ToolbarButton';
import Icons from './ToolbarIcon';

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

  return (
    <ContextMenu align='left'>
      <ContextMenu.Trigger
        as={ToolbarButton}
        icon={Icons.table}
        title={t('shared:form.wysiwyg.tableActions', 'Table Actions')}
        isActive={editor.isActive('table')}
        disabled={disabled}
      />

      <ContextMenu.Menu>
        {/* Insert */}
        <ContextMenu.Item
          icon={Icons.table}
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
              .run()
          }
        >
          {t('shared:form.wysiwyg.tableInsert', 'Insert Table')}
        </ContextMenu.Item>

        {editor.isActive('table') && (
          <>
            <ContextMenu.Divider />

            {/* Row actions */}
            <ContextMenu.Item
              icon={Icons.tableAddRowBefore}
              onClick={() => editor.chain().focus().addRowBefore().run()}
            >
              {t('shared:form.wysiwyg.tableRowBefore', 'Add Row Before')}
            </ContextMenu.Item>
            <ContextMenu.Item
              icon={Icons.tableRow}
              onClick={() => editor.chain().focus().addRowAfter().run()}
            >
              {t('shared:form.wysiwyg.tableRowAfter', 'Add Row After')}
            </ContextMenu.Item>
            <ContextMenu.Item
              icon={Icons.tableDeleteRow}
              onClick={() => editor.chain().focus().deleteRow().run()}
              variant='danger'
            >
              {t('shared:form.wysiwyg.tableDeleteRow', 'Delete Row')}
            </ContextMenu.Item>

            <ContextMenu.Divider />

            {/* Column actions */}
            <ContextMenu.Item
              icon={Icons.tableAddColBefore}
              onClick={() => editor.chain().focus().addColumnBefore().run()}
            >
              {t('shared:form.wysiwyg.tableColBefore', 'Add Column Before')}
            </ContextMenu.Item>
            <ContextMenu.Item
              icon={Icons.tableCol}
              onClick={() => editor.chain().focus().addColumnAfter().run()}
            >
              {t('shared:form.wysiwyg.tableColAfter', 'Add Column After')}
            </ContextMenu.Item>
            <ContextMenu.Item
              icon={Icons.tableDeleteCol}
              onClick={() => editor.chain().focus().deleteColumn().run()}
              variant='danger'
            >
              {t('shared:form.wysiwyg.tableDeleteCol', 'Delete Column')}
            </ContextMenu.Item>

            <ContextMenu.Divider />

            {/* Cell & header actions */}
            <ContextMenu.Item
              icon={Icons.tableMergeOrSplit}
              onClick={() => editor.chain().focus().mergeOrSplit().run()}
            >
              {t('shared:form.wysiwyg.tableMergeOrSplit', 'Merge/Split Cells')}
            </ContextMenu.Item>
            <ContextMenu.Item
              icon={Icons.tableToggleHeader}
              onClick={() => editor.chain().focus().toggleHeaderRow().run()}
            >
              {t(
                'shared:form.wysiwyg.tableToggleHeaderRow',
                'Toggle Header Row',
              )}
            </ContextMenu.Item>
            <ContextMenu.Item
              icon={Icons.tableToggleHeader}
              onClick={() => editor.chain().focus().toggleHeaderColumn().run()}
            >
              {t(
                'shared:form.wysiwyg.tableToggleHeaderCol',
                'Toggle Header Column',
              )}
            </ContextMenu.Item>

            <ContextMenu.Divider />

            {/* Delete table */}
            <ContextMenu.Item
              icon={Icons.tableDelete}
              onClick={() => editor.chain().focus().deleteTable().run()}
              variant='danger'
            >
              {t('shared:form.wysiwyg.tableDelete', 'Delete Table')}
            </ContextMenu.Item>
          </>
        )}
      </ContextMenu.Menu>
    </ContextMenu>
  );
}

TableActionsPopup.propTypes = {
  editor: PropTypes.object.isRequired,
  disabled: PropTypes.bool,
};
