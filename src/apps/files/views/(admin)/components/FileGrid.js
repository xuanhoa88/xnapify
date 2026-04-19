/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useRef, useCallback } from 'react';

import {
  ArchiveIcon,
  FileIcon,
  StarIcon,
  Pencil1Icon,
  Share1Icon,
  CopyIcon,
  DownloadIcon,
  TrashIcon,
} from '@radix-ui/react-icons';
import { Box, Flex, Text, Grid } from '@radix-ui/themes';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import ContextMenu from '@shared/renderer/components/ContextMenu';
import Loader from '@shared/renderer/components/Loader';
import Modal from '@shared/renderer/components/Modal';
import { TablePagination } from '@shared/renderer/components/Table';
import { getUserId } from '@shared/renderer/redux/features/user/selector';
import { validateForm } from '@shared/validator';

import { renameFileFormSchema } from '../../../validator/admin/file';
import {
  toggleSelection,
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
} from '../redux';

import s from './FileGrid.css';

export default function FileGrid({ onShare }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const currentUserId = useSelector(getUserId);
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

  const [contextMenu, setContextMenu] = useState(null);
  const [targetFile, setTargetFile] = useState(null);
  const renamePromptRef = useRef(null);

  // Close context menu on any outside click handled by Shared ContextMenu so we don't need body click listener

  const handleFileClick = useCallback(
    (e, fileId) => {
      e.stopPropagation(); // Prevent deselecting
      const multi = e.ctrlKey || e.metaKey;
      dispatch(toggleSelection({ fileId, multi }));
    },
    [dispatch],
  );

  const handleContainerClick = useCallback(() => {
    dispatch(clearSelection());
  }, [dispatch]);

  const handleDoubleClick = useCallback(
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

  const handleContextMenu = useCallback(
    (e, file) => {
      e.preventDefault();
      e.stopPropagation();

      // Select the file if not already selected
      if (!selectedIds.includes(file.id)) {
        dispatch(toggleSelection({ fileId: file.id, multi: false }));
      }

      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        file,
      });
    },
    [dispatch, selectedIds],
  );

  const onRename = useCallback(() => {
    if (!contextMenu) return;
    const { file } = contextMenu;
    setContextMenu(null); // Close the menu
    setTargetFile(file);
    renamePromptRef.current.open({
      title: t('files:grid.rename', 'Rename'),
      defaultValue: file.name,
    });
  }, [contextMenu, t]);

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

  const onTrash = useCallback(() => {
    if (!contextMenu) return;
    const idsToDelete =
      selectedIds.length > 0 ? selectedIds : [contextMenu.file.id];

    setContextMenu(null); // Close menu
    if (currentView === 'trash') {
      dispatch(deleteItemsPermanently(idsToDelete));
    } else {
      dispatch(trashItems(idsToDelete));
    }
  }, [contextMenu, currentView, dispatch, selectedIds]);

  const onStar = useCallback(() => {
    if (!contextMenu) return;
    setContextMenu(null); // Close menu
    dispatch(
      toggleStarItem({
        id: contextMenu.file.id,
        isStarred: !contextMenu.file.is_starred,
      }),
    );
  }, [contextMenu, dispatch]);

  const onDownload = useCallback(() => {
    if (!contextMenu) return;
    setContextMenu(null); // Close menu
    window.open(
      `/api/files/${contextMenu.file.id}/download?download=true`,
      '_blank',
    );
  }, [contextMenu]);

  const onCopyLink = useCallback(() => {
    if (!contextMenu) return;
    setContextMenu(null); // Close menu
    const link = `${window.location.origin}/api/files/${contextMenu.file.id}/download`;
    navigator.clipboard.writeText(link);
    alert(t('files:grid.link_copied', 'Link copied to clipboard!'));
  }, [contextMenu, t]);

  const handleShare = useCallback(() => {
    if (!contextMenu) return;
    setContextMenu(null); // Close menu
    if (onShare) onShare(contextMenu.file);
  }, [contextMenu, onShare]);

  if (!initialized || (loading && (!files || files.length === 0))) {
    return (
      <Loader
        variant={viewMode === 'grid' ? 'cards' : 'skeleton'}
        message={t('files:grid.loading', 'Loading files...')}
      />
    );
  }

  if (!files || files.length === 0) {
    return (
      <Flex
        direction='column'
        align='center'
        justify='center'
        className={s.emptyContainer}
        role='button'
        tabIndex={0}
        onClick={handleContainerClick}
        onKeyDown={e => e.key === 'Enter' && handleContainerClick()}
      >
        <Box className={s.emptyIconBox}>
          <ArchiveIcon width={80} height={80} />
        </Box>
        <Text as='h3' size='4' weight='bold' className={s.emptyTitle}>
          {t('files:grid.empty_title', 'No files here')}
        </Text>
        <Text as='p' size='2' color='gray'>
          {t(
            'files:grid.empty_desc',
            'Drop files here or use the "New" button.',
          )}
        </Text>
      </Flex>
    );
  }

  return (
    <Box
      role='presentation'
      className={s.gridContainer}
      onClick={handleContainerClick}
      onContextMenu={e => e.preventDefault()}
    >
      {/* File Items */}
      {viewMode === 'grid' ? (
        <Grid
          columns={{ initial: '1', xs: '2', sm: '3', md: '4', lg: '5' }}
          gap='4'
          className={s.gridWrapper}
        >
          {files.map(file => (
            <Flex
              direction='column'
              key={file.id}
              role='button'
              tabIndex={0}
              className={clsx(
                s.fileCard,
                selectedIds.includes(file.id)
                  ? s.fileCardSelected
                  : s.fileCardUnselected,
              )}
              onClick={e => handleFileClick(e, file.id)}
              onKeyDown={e => e.key === 'Enter' && handleDoubleClick(file)}
              onDoubleClick={() => handleDoubleClick(file)}
              onContextMenu={e => handleContextMenu(e, file)}
            >
              <Flex
                align='center'
                justify='center'
                className={clsx(
                  s.iconContainer,
                  file.type === 'folder' ? s.folderIcon : s.fileIcon,
                )}
              >
                {file.type === 'folder' ? (
                  <ArchiveIcon width={48} height={48} />
                ) : (
                  <FileIcon width={48} height={48} />
                )}
                {file.is_starred && currentView !== 'trash' && (
                  <Box className={s.starIconGrid}>
                    <StarIcon width={16} height={16} />
                  </Box>
                )}
              </Flex>
              <Flex
                direction='column'
                align='center'
                className={s.nameContainer}
              >
                <Text
                  as='span'
                  size='2'
                  weight='medium'
                  className={s.fileName}
                  title={file.name}
                >
                  {file.name}
                </Text>
              </Flex>
            </Flex>
          ))}
        </Grid>
      ) : (
        <Flex direction='column' className={s.listWrapper}>
          {/* List View Header */}
          <Flex align='center' className={s.listHeader}>
            <Box className={s.iconSpace} /> {/* Icon space */}
            <Box className={s.flex3}>{t('files:grid.name', 'Name')}</Box>
            <Box className={s.flex2HiddenSm}>
              {t('files:grid.owner', 'Owner')}
            </Box>
            <Box className={s.flex2HiddenXs}>
              {t('files:grid.last_modified', 'Last Modified')}
            </Box>
            <Box className={s.flex1HiddenMd}>
              {t('files:grid.file_size', 'File Size')}
            </Box>
          </Flex>

          {/* List Items */}
          {files.map(file => (
            <Flex
              align='center'
              key={file.id}
              role='button'
              tabIndex={0}
              className={clsx(
                s.listItem,
                selectedIds.includes(file.id)
                  ? s.listItemSelected
                  : s.listItemUnselected,
              )}
              onClick={e => handleFileClick(e, file.id)}
              onKeyDown={e => e.key === 'Enter' && handleDoubleClick(file)}
              onDoubleClick={() => handleDoubleClick(file)}
              onContextMenu={e => handleContextMenu(e, file)}
            >
              <Flex
                align='center'
                justify='center'
                className={clsx(
                  s.listIconContainer,
                  file.type === 'folder' ? s.folderIcon : s.fileIcon,
                )}
              >
                {file.type === 'folder' ? (
                  <ArchiveIcon width={24} height={24} />
                ) : (
                  <FileIcon width={24} height={24} />
                )}
                {file.is_starred && currentView !== 'trash' && (
                  <Box className={s.starIconList}>
                    <StarIcon width={10} height={10} />
                  </Box>
                )}
              </Flex>
              <Box className={s.listNameBox}>
                <Text
                  as='span'
                  size='2'
                  weight='medium'
                  className={s.listFileName}
                  title={file.name}
                >
                  {file.name}
                </Text>
              </Box>
              <Box className={s.listOwnerBox}>
                <Text as='span' size='1' color='gray'>
                  {file.owner && file.owner.email
                    ? file.owner.email
                    : t('files:grid.owner_me', 'Me')}
                </Text>
              </Box>
              <Box className={s.listModifiedBox}>
                <Text as='span' size='1' color='gray'>
                  {new Date(file.updated_at).toLocaleDateString()}
                </Text>
              </Box>
              <Box className={s.listSizeBox}>
                <Text as='span' size='1' color='gray'>
                  {file.size
                    ? `${(file.size / 1024 / 1024).toFixed(2)} MB`
                    : '-'}
                </Text>
              </Box>
            </Flex>
          ))}
        </Flex>
      )}

      {/* Context Menu logic utilizing shared component */}
      {contextMenu && (
        <ContextMenu
          isOpen={true}
          onToggle={() => setContextMenu(null)}
          x={contextMenu.x}
          y={contextMenu.y}
        >
          <ContextMenu.Menu>
            {contextMenu.file.owner_id === currentUserId && (
              <ContextMenu.Item
                onClick={onRename}
                icon={<Pencil1Icon width={16} height={16} />}
              >
                {t('files:grid.rename', 'Rename')}
              </ContextMenu.Item>
            )}
            <ContextMenu.Item
              onClick={handleShare}
              icon={<Share1Icon width={16} height={16} />}
            >
              {t('files:grid.share', 'Share')}
            </ContextMenu.Item>

            <ContextMenu.Item
              onClick={onCopyLink}
              icon={<CopyIcon width={16} height={16} />}
            >
              {t('files:grid.copy_link', 'Copy link')}
            </ContextMenu.Item>

            {contextMenu.file.type === 'file' && (
              <ContextMenu.Item
                onClick={onDownload}
                icon={<DownloadIcon width={16} height={16} />}
              >
                {t('files:grid.download', 'Download')}
              </ContextMenu.Item>
            )}

            <ContextMenu.Item
              onClick={onStar}
              icon={<StarIcon width={16} height={16} />}
            >
              {contextMenu.file.is_starred
                ? t('files:grid.remove_star', 'Remove Star')
                : t('files:grid.add_star', 'Add Star')}
            </ContextMenu.Item>

            {contextMenu.file.owner_id === currentUserId && (
              <>
                <ContextMenu.Divider />
                <ContextMenu.Item
                  onClick={onTrash}
                  variant='danger'
                  icon={<TrashIcon width={16} height={16} />}
                >
                  {currentView === 'trash'
                    ? t('files:grid.delete_permanently', 'Delete Permanently')
                    : t('files:grid.move_to_trash', 'Move to Trash')}
                </ContextMenu.Item>
              </>
            )}
          </ContextMenu.Menu>
        </ContextMenu>
      )}
      {/* RENAME PROMPT */}
      <Modal.ConfirmPrompt
        ref={renamePromptRef}
        onSubmit={handleRenameSubmit}
      />
      {/* PAGINATION */}
      {totalPages > 1 && (
        <Box className={s.paginationContainer}>
          <TablePagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={totalItems}
            onPageChange={newPage => dispatch(setPage(newPage))}
            loading={loading}
          />
        </Box>
      )}
    </Box>
  );
}

FileGrid.propTypes = {
  onShare: PropTypes.func,
};
