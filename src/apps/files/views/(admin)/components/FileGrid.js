/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import Loader from '@shared/renderer/components/Loader';
import ConfirmModal from '@shared/renderer/components/ConfirmModal';
import Pagination from '@shared/renderer/components/Table/Pagination';
import ContextMenu from '@shared/renderer/components/ContextMenu';
import Icon from '@shared/renderer/components/Icon';
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
import { getUserId } from '@shared/renderer/redux/features/user/selector';
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
      <div
        role='button'
        tabIndex={0}
        className={s.emptyState}
        onClick={handleContainerClick}
        onKeyDown={e => e.key === 'Enter' && handleContainerClick()}
      >
        <div className={s.emptyStateIcon}>
          <Icon name='folder' size={80} />
        </div>
        <h3>{t('files:grid.empty_title', 'No files here')}</h3>
        <p>
          {t(
            'files:grid.empty_desc',
            'Drop files here or use the "New" button.',
          )}
        </p>
      </div>
    );
  }

  return (
    <div
      role='presentation'
      className={clsx(s.container, {
        [s.gridView]: viewMode === 'grid',
        [s.listView]: viewMode === 'list',
      })}
      onClick={handleContainerClick}
      onContextMenu={e => e.preventDefault()}
    >
      {/* File Items */}
      <div className={s.grid}>
        {files.map(file => (
          <div
            key={file.id}
            role='button'
            tabIndex={0}
            className={clsx(s.fileItem, {
              [s.selected]: selectedIds.includes(file.id),
            })}
            onClick={e => handleFileClick(e, file.id)}
            onKeyDown={e => e.key === 'Enter' && handleDoubleClick(file)}
            onDoubleClick={() => handleDoubleClick(file)}
            onContextMenu={e => handleContextMenu(e, file)}
          >
            <div className={s.iconContainer}>
              {file.type === 'folder' ? (
                <Icon name='folder' size={48} className={s.fileIcon} />
              ) : (
                <Icon name='file' size={48} className={s.fileIcon} />
              )}
              {file.is_starred && currentView !== 'trash' && (
                <div className={s.starBadge}>
                  <Icon name='star' size={16} className={s.starIcon} />
                </div>
              )}
            </div>
            <div className={s.nameContainer}>
              <span className={s.fileName} title={file.name}>
                {file.name}
              </span>
              {viewMode === 'list' && (
                <>
                  <span className={s.fileDetail}>
                    {file.owner && file.owner.email
                      ? file.owner.email
                      : t('files:grid.owner_me', 'Me')}
                  </span>
                  <span className={s.fileDetail}>
                    {new Date(file.updated_at).toLocaleDateString()}
                  </span>
                  <span className={s.fileDetail}>
                    {file.size
                      ? `${(file.size / 1024 / 1024).toFixed(2)} MB`
                      : '-'}
                  </span>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
      {/* Context Menu logic utilizing shared component */}
      {contextMenu && (
        <ContextMenu
          isOpen={true}
          onToggle={() => setContextMenu(null)}
          x={contextMenu.x}
          y={contextMenu.y}
        >
          <div className={s.contextMenuContainer}>
            <ContextMenu.Menu>
              {contextMenu.file.owner_id === currentUserId && (
                <ContextMenu.Item
                  onClick={onRename}
                  icon={<Icon name='edit-2' size={16} />}
                >
                  {t('files:grid.rename', 'Rename')}
                </ContextMenu.Item>
              )}
              <ContextMenu.Item
                onClick={handleShare}
                icon={<Icon name='share' size={16} />}
              >
                {t('files:grid.share', 'Share')}
              </ContextMenu.Item>

              <ContextMenu.Item
                onClick={onCopyLink}
                icon={<Icon name='copy' size={16} />}
              >
                {t('files:grid.copy_link', 'Copy link')}
              </ContextMenu.Item>

              {contextMenu.file.type === 'file' && (
                <ContextMenu.Item
                  onClick={onDownload}
                  icon={<Icon name='download' size={16} />}
                >
                  {t('files:grid.download', 'Download')}
                </ContextMenu.Item>
              )}

              <ContextMenu.Item
                onClick={onStar}
                icon={<Icon name='star' size={16} />}
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
                    icon={<Icon name='trash' size={16} />}
                  >
                    {currentView === 'trash'
                      ? t('files:grid.delete_permanently', 'Delete Permanently')
                      : t('files:grid.move_to_trash', 'Move to Trash')}
                  </ContextMenu.Item>
                </>
              )}
            </ContextMenu.Menu>
          </div>
        </ContextMenu>
      )}
      {/* RENAME PROMPT */}
      <ConfirmModal.Prompt
        ref={renamePromptRef}
        onSubmit={handleRenameSubmit}
      />
      {/* PAGINATION */}
      {totalPages > 1 && (
        <div className={s.paginationWrapper}>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={totalItems}
            onPageChange={newPage => dispatch(setPage(newPage))}
            loading={loading}
          />
        </div>
      )}
    </div>
  );
}

FileGrid.propTypes = {
  onShare: PropTypes.func,
};
