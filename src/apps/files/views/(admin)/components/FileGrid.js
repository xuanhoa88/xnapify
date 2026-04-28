/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useRef, useCallback, useMemo } from 'react';

import {
  FileIcon,
  StarFilledIcon,
  ArchiveIcon as FolderIcon,
} from '@radix-ui/react-icons';
import { Box, Flex, Text, Card } from '@radix-ui/themes';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import Modal from '@shared/renderer/components/Modal';
import { DataTable } from '@shared/renderer/components/Table';
import { validateForm } from '@shared/validator';

import { renameFileFormSchema } from '../../../validator/admin/file';
import {
  setSelection,
  clearSelection,
  setView,
  trashItems,
  toggleStarItem,
  renameItem,
  deleteItemsPermanently,
  selectFiles,
  selectViewMode,
  selectSelectedFileIds,
  selectLoadingFiles,
  selectInitializedFiles,
  selectCurrentView,
  selectPage,
  selectPageSize,
  selectTotalItems,
  setPage,
  setPageSize,
} from '../redux';

import FileActionsDropdown from './FileActionsDropdown';

import s from './FileGrid.css';

export default function FileGrid({ onShare }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const files = useSelector(selectFiles);
  const viewMode = useSelector(selectViewMode);
  const selectedIds = useSelector(selectSelectedFileIds);
  const loading = useSelector(selectLoadingFiles);
  const initialized = useSelector(selectInitializedFiles);
  const currentView = useSelector(selectCurrentView);
  const page = useSelector(selectPage);
  const pageSize = useSelector(selectPageSize);
  const totalItems = useSelector(selectTotalItems);
  const totalPages = Math.ceil(totalItems / pageSize);

  const [targetFile, setTargetFile] = useState(null);
  const renamePromptRef = useRef(null);

  const handleContainerClick = useCallback(
    e => {
      // Do not clear selection if interacting with buttons, cards, or menus
      if (
        e.target.closest('button') ||
        e.target.closest('[role="button"]') ||
        e.target.closest('a') ||
        e.target.closest('[role="menu"]') ||
        e.target.closest('[role="menuitem"]')
      ) {
        return;
      }
      dispatch(clearSelection());
    },
    [dispatch],
  );

  const handleOpen = useCallback(
    file => {
      if (file.type === 'folder') {
        dispatch(setView({ view: currentView, folderId: file.id }));
      } else {
        // For now, downloading/previewing
        window.open(`/api/files/${file.id}/download`, '_blank');
      }
    },
    [dispatch, currentView],
  );

  const onRename = useCallback(
    file => {
      setTargetFile(file);
      renamePromptRef.current.open({
        title: t('files:grid.rename', 'Rename'),
        defaultValue: file.name,
      });
    },
    [t],
  );

  const handleRenameSubmit = useCallback(
    async newName => {
      if (!targetFile) return { success: false, error: 'No file selected' };

      const [isValid, errors] = validateForm(renameFileFormSchema, {
        name: newName,
      });

      if (!isValid) {
        return {
          success: false,
          error:
            (errors.name && errors.name[0]) ||
            t('files:grid.invalid_name', 'Invalid name'),
        };
      }

      try {
        await dispatch(
          renameItem({ id: targetFile.id, name: newName.trim() }),
        ).unwrap();
        setTargetFile(null);
        return { success: true };
      } catch (err) {
        return {
          success: false,
          error: err.message || t('files:grid.rename_failed', 'Rename failed'),
        };
      }
    },
    [dispatch, targetFile, t],
  );

  const onTrash = useCallback(
    file => {
      let idsToDelete = [];
      if (!file) {
        idsToDelete = selectedIds;
      } else {
        idsToDelete = selectedIds.includes(file.id) ? selectedIds : [file.id];
      }

      if (idsToDelete.length === 0) return;

      if (currentView === 'trash') {
        dispatch(deleteItemsPermanently(idsToDelete));
      } else {
        dispatch(trashItems(idsToDelete));
      }
    },
    [currentView, dispatch, selectedIds],
  );

  const onStar = useCallback(
    file => {
      dispatch(
        toggleStarItem({
          id: file.id,
          isStarred: !file.is_starred,
        }),
      );
    },
    [dispatch],
  );

  const onDownload = useCallback(file => {
    window.open(`/api/files/${file.id}/download?download=true`, '_blank');
  }, []);

  const onCopyLink = useCallback(
    file => {
      const link = `${window.location.origin}/api/files/${file.id}/download`;
      navigator.clipboard.writeText(link);
      alert(t('files:grid.link_copied', 'Link copied to clipboard!'));
    },
    [t],
  );

  const handleShareLocal = useCallback(
    file => {
      if (onShare) onShare(file);
    },
    [onShare],
  );

  const columns = useMemo(
    () => [
      {
        key: 'name',
        dataIndex: 'name',
        title: t('files:grid.name', 'Name'),
        order: 10,
        render: (value, file) => (
          <Flex align='center' gap='2' style={{ minWidth: 0 }}>
            <Flex
              align='center'
              justify='center'
              className={clsx(
                s.listIconContainer,
                file.type === 'folder' ? s.folderIcon : s.fileIcon,
              )}
            >
              {file.type === 'folder' ? (
                <FolderIcon width={24} height={24} />
              ) : (
                <FileIcon width={24} height={24} />
              )}
              {file.is_starred && currentView !== 'trash' && (
                <Box className={s.starIconList}>
                  <StarFilledIcon width={12} height={12} />
                </Box>
              )}
            </Flex>
            <Text
              size='2'
              weight='medium'
              truncate
              highContrast
              title={file.name}
              style={{ minWidth: 0, flex: 1 }}
            >
              {file.name}
            </Text>
          </Flex>
        ),
      },
      {
        key: 'owner',
        dataIndex: 'owner',
        title: t('files:grid.owner', 'Owner'),
        order: 20,
        className: s.hiddenSm,
        render: (value, file) => (
          <Text size='1' color='gray'>
            {file.owner && file.owner.email
              ? file.owner.email
              : t('files:grid.owner_me', 'Me')}
          </Text>
        ),
      },
      {
        key: 'last_modified',
        dataIndex: 'updated_at',
        title: t('files:grid.last_modified', 'Last Modified'),
        order: 30,
        className: s.hiddenXs,
        render: value => (
          <Text size='1' color='gray'>
            {new Date(value).toLocaleDateString()}
          </Text>
        ),
      },
      {
        key: 'size',
        dataIndex: 'size',
        title: t('files:grid.file_size', 'File Size'),
        order: 40,
        className: s.hiddenMd,
        render: value => (
          <Text size='1' color='gray'>
            {value ? `${(value / 1024 / 1024).toFixed(2)} MB` : '-'}
          </Text>
        ),
      },
      {
        key: 'actions',
        order: 100,
        width: 60,
        align: 'right',
        render: (_, file) => (
          <FileActionsDropdown
            file={file}
            onRename={onRename}
            onShare={handleShareLocal}
            onCopyLink={onCopyLink}
            onDownload={onDownload}
            onStar={onStar}
            onTrash={onTrash}
          />
        ),
      },
    ],
    [
      t,
      currentView,
      onRename,
      handleShareLocal,
      onCopyLink,
      onDownload,
      onStar,
      onTrash,
    ],
  );

  const renderCard = useCallback(
    file => (
      <Card
        variant='surface'
        className={s.fileCard}
        role='button'
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && handleOpen(file)}
        onClick={() => handleOpen(file)}
      >
        <Flex
          align='center'
          justify='center'
          className={clsx(
            s.iconContainer,
            file.type === 'folder' ? s.folderIcon : s.fileIcon,
          )}
        >
          <Box className='relative inline-flex'>
            {file.type === 'folder' ? (
              <FolderIcon width={48} height={48} />
            ) : (
              <FileIcon width={48} height={48} />
            )}
            {file.is_starred && currentView !== 'trash' && (
              <Box className={s.starIconGrid}>
                <StarFilledIcon width={16} height={16} />
              </Box>
            )}
          </Box>
        </Flex>
        <Flex direction='column' className={s.nameContainer}>
          <Text
            as='span'
            size='2'
            weight='medium'
            truncate
            align='center'
            highContrast
            title={file.name}
            style={{ width: '100%' }}
          >
            {file.name}
          </Text>
        </Flex>
        <Box className={s.cardActions}>
          <FileActionsDropdown
            file={file}
            onRename={onRename}
            onShare={handleShareLocal}
            onCopyLink={onCopyLink}
            onDownload={onDownload}
            onStar={onStar}
            onTrash={onTrash}
          />
        </Box>
      </Card>
    ),
    [
      currentView,
      handleOpen,
      onRename,
      handleShareLocal,
      onCopyLink,
      onDownload,
      onStar,
      onTrash,
    ],
  );

  return (
    <Box
      role='presentation'
      className={s.gridContainer}
      onClick={handleContainerClick}
    >
      <DataTable
        dataSource={files}
        rowKey='id'
        loading={loading}
        initialized={initialized}
        viewType={viewMode === 'list' ? 'table' : 'grid'}
        columns={columns}
        borderless
        renderCard={renderCard}
        selectable
        selectedKeys={selectedIds}
        onSelectionChange={keys => dispatch(setSelection(keys))}
        onRowClick={handleOpen}
      >
        <DataTable.Empty
          icon={<FolderIcon width={48} height={48} />}
          title={t('files:grid.empty_title', 'No files here')}
          description={t(
            'files:grid.empty_desc',
            'Drop files here or use the "New" button.',
          )}
        />
        <DataTable.BulkActions
          count={selectedIds.length}
          onClear={() => dispatch(clearSelection())}
          actions={[
            {
              label: t('common:delete', 'Delete'),
              icon: 'TrashIcon',
              variant: 'danger',
              onClick: () => onTrash(),
            },
          ]}
        />
        <DataTable.Loader
          variant={viewMode === 'grid' ? 'cards' : 'skeleton'}
        />
        <DataTable.Pagination
          current={page}
          totalPages={totalPages || 1}
          total={totalItems}
          pageSize={pageSize}
          pageSizeOptions={[10, 20, 50, 100]}
          onChange={p => dispatch(setPage(p))}
          onPageSizeChange={s => dispatch(setPageSize(s))}
        />
      </DataTable>

      {/* RENAME PROMPT */}
      <Modal.ConfirmPrompt
        ref={renamePromptRef}
        onSubmit={handleRenameSubmit}
      />
    </Box>
  );
}

FileGrid.propTypes = {
  onShare: PropTypes.func,
};
