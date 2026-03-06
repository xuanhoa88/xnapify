/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import {
  Loader,
  ConfirmModal,
} from '../../../../../shared/renderer/components/Admin';
import Pagination from '../../../../../shared/renderer/components/Admin/Table/Pagination';
import Icon from '../../../../../shared/renderer/components/Icon';
import { validateForm } from '../../../../../shared/validator';
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

  // Close context menu on any outside click
  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  const handleFileClick = (e, fileId) => {
    e.stopPropagation(); // Prevent deselecting
    const multi = e.ctrlKey || e.metaKey;
    dispatch(toggleSelection({ fileId, multi }));
  };

  const handleContainerClick = () => {
    dispatch(clearSelection());
  };

  const handleDoubleClick = file => {
    if (file.type === 'folder') {
      dispatch(setView({ view: 'my_drive', folderId: file.id }));
    } else {
      // For now, downloading/previewing
      window.open(`/api/admin/files/${file.id}/download`, '_blank');
    }
  };

  const handleContextMenu = (e, file) => {
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
  };

  const onRename = () => {
    if (!contextMenu) return;
    const { file } = contextMenu;
    setTargetFile(file);
    renamePromptRef.current.open({
      title: t('files:grid.rename', 'Rename'),
      defaultValue: file.name,
    });
  };

  const handleRenameSubmit = async newName => {
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
  };

  const onTrash = () => {
    if (!contextMenu) return;
    const idsToDelete =
      selectedIds.length > 0 ? selectedIds : [contextMenu.file.id];

    if (currentView === 'trash') {
      dispatch(deleteItemsPermanently(idsToDelete));
    } else {
      dispatch(trashItems(idsToDelete));
    }
  };

  const onStar = () => {
    if (!contextMenu) return;
    dispatch(
      toggleStarItem({
        id: contextMenu.file.id,
        isStarred: !contextMenu.file.is_starred,
      }),
    );
  };

  const onDownload = () => {
    if (!contextMenu) return;
    window.open(
      `/api/admin/files/${contextMenu.file.id}/download?download=true`,
      '_blank',
    );
  };

  const handleShare = () => {
    if (!contextMenu) return;
    if (onShare) onShare(contextMenu.file);
  };

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
        {files.map(file => {
          const isSelected = selectedIds.includes(file.id);

          return (
            <div
              key={file.id}
              role='button'
              tabIndex={0}
              className={clsx(s.fileItem, {
                [s.selected]: isSelected,
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
          );
        })}
      </div>
      {/* Context Menu */}
      {contextMenu && (
        <div
          className={s.contextMenu}
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <div
            role='button'
            tabIndex={0}
            className={s.menuItem}
            onClick={onRename}
            onKeyDown={e => e.key === 'Enter' && onRename()}
          >
            {t('files:grid.rename', 'Rename')}
          </div>
          <div
            role='button'
            tabIndex={0}
            className={s.menuItem}
            onClick={handleShare}
            onKeyDown={e => e.key === 'Enter' && handleShare()}
          >
            {t('files:grid.share', 'Share')}
          </div>
          {contextMenu.file.type === 'file' && (
            <div
              role='button'
              tabIndex={0}
              className={s.menuItem}
              onClick={onDownload}
              onKeyDown={e => e.key === 'Enter' && onDownload()}
            >
              {t('files:grid.download', 'Download')}
            </div>
          )}
          <div
            role='button'
            tabIndex={0}
            className={s.menuItem}
            onClick={onStar}
            onKeyDown={e => e.key === 'Enter' && onStar()}
          >
            {contextMenu.file.is_starred
              ? t('files:grid.remove_star', 'Remove Star')
              : t('files:grid.add_star', 'Add Star')}
          </div>
          <div className={s.menuDivider} />
          <div
            role='button'
            tabIndex={0}
            className={clsx(s.menuItem, s.dangerItem)}
            onClick={onTrash}
            onKeyDown={e => e.key === 'Enter' && onTrash()}
          >
            {currentView === 'trash'
              ? t('files:grid.delete_permanently', 'Delete Permanently')
              : t('files:grid.move_to_trash', 'Move to Trash')}
          </div>
        </div>
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
