/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useRef, useState } from 'react';

import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { v4 as uuidv4 } from 'uuid';
import { Icon } from '../../../../../shared/renderer/components/Admin';
import Button from '../../../../../shared/renderer/components/Button';
import {
  setUploadModalOpen,
  addUploadItem,
  updateUploadProgress,
  clearCompletedUploads,
} from '../redux';
import { createFolder, fetchFiles, uploadFile } from '../redux/thunks';
import {
  selectUploadModalOpen,
  selectCurrentFolderId,
  selectCurrentView,
  selectActiveUploads,
} from '../redux/selector';
import s from './FileUploader.css';

function FileUploader() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const isOpen = useSelector(selectUploadModalOpen);
  const currentFolderId = useSelector(selectCurrentFolderId);
  const currentView = useSelector(selectCurrentView);
  const activeUploads = useSelector(selectActiveUploads);

  const fileInputRef = useRef(null);
  const [folderName, setFolderName] = useState(
    t('files:uploader.untitled_folder', 'Untitled folder'),
  );
  const [showFolderInput, setShowFolderInput] = useState(false);

  const handleClose = () => {
    dispatch(setUploadModalOpen(false));
    setShowFolderInput(false);
    setFolderName(t('files:uploader.untitled_folder', 'Untitled folder'));
  };

  const handleCreateFolder = () => {
    if (folderName.trim()) {
      dispatch(
        createFolder({ name: folderName.trim(), parentId: currentFolderId }),
      );
      handleClose();
    }
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async e => {
    const { files } = e.target;
    if (!files || files.length === 0) return;

    handleClose(); // Close the "New" modal

    // Process each file
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const uploadId = uuidv4();

      // Start tracking upload in redux state
      dispatch(
        addUploadItem({
          id: uploadId,
          name: file.name,
          progress: 0,
          status: 'uploading',
        }),
      );

      const formData = new FormData();
      formData.append('file', file);
      if (currentFolderId) {
        formData.append('parentId', currentFolderId);
      }

      try {
        const resultAction = await dispatch(uploadFile(formData));

        if (uploadFile.fulfilled.match(resultAction)) {
          dispatch(
            updateUploadProgress({
              id: uploadId,
              progress: 100,
              status: 'completed',
            }),
          );
          // Trigger refresh
          dispatch(
            fetchFiles({ view: currentView, parentId: currentFolderId }),
          );
        } else {
          // Promise rejected
          console.error(
            'Upload failed with error',
            resultAction.payload || resultAction.error,
          );
          dispatch(
            updateUploadProgress({
              id: uploadId,
              status: 'error',
              error:
                resultAction.payload ||
                t('files:uploader.failed', 'Upload failed'),
            }),
          );
        }
      } catch (err) {
        console.error('File Upload Error', err);
        dispatch(
          updateUploadProgress({
            id: uploadId,
            status: 'error',
            error: err.message,
          }),
        );
      }
    }

    // Reset file input
    e.target.value = null;
  };

  return (
    <>
      <input
        type='file'
        ref={fileInputRef}
        className={s.hiddenInput}
        onChange={handleFileChange}
        multiple
      />

      {/* NEW MENU DIALOG */}
      {isOpen && (
        <>
          {/* Backdrop for click-away */}
          <div
            role='presentation'
            className={s.backdrop}
            onClick={handleClose}
          />

          <div className={s.newMenuModal}>
            {!showFolderInput ? (
              <div className={s.menuOptions}>
                <Button
                  variant='ghost'
                  className={s.menuItem}
                  onClick={() => setShowFolderInput(true)}
                >
                  <Icon name='folder' size={24} />
                  <span>{t('files:uploader.new_folder', 'New folder')}</span>
                </Button>
                <div className={s.divider} />
                <Button
                  variant='ghost'
                  className={s.menuItem}
                  onClick={triggerFileInput}
                >
                  <Icon name='upload' size={24} />
                  <span>{t('files:uploader.file_upload', 'File upload')}</span>
                </Button>
              </div>
            ) : (
              <div className={s.folderInputContainer}>
                <h3>{t('files:uploader.new_folder', 'New folder')}</h3>
                <input
                  type='text'
                  value={folderName}
                  onChange={e => setFolderName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleCreateFolder();
                  }}
                  className={s.inputField}
                />
                <div className={s.dialogActions}>
                  <Button
                    variant='outline'
                    className={clsx(s.btn, s.btnText)}
                    onClick={handleClose}
                  >
                    {t('files:uploader.cancel', 'Cancel')}
                  </Button>
                  <Button
                    variant='primary'
                    className={clsx(s.btn, s.btnPrimary)}
                    onClick={handleCreateFolder}
                  >
                    {t('files:uploader.create', 'Create')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* UPLOAD PROGRESS TRACKER (Bottom Right) */}
      {activeUploads.length > 0 && (
        <div className={s.uploadTracker}>
          <div className={s.trackerHeader}>
            <span>
              {t('files:uploader.uploads_status', {
                count: activeUploads.filter(u => u.status === 'completed')
                  .length,
                total: activeUploads.length,
              })}
            </span>
            <Button
              variant='ghost'
              iconOnly
              className={s.iconBtn}
              onClick={() => dispatch(clearCompletedUploads())}
            >
              <Icon name='close' size={24} />
            </Button>
          </div>
          <div className={s.trackerList}>
            {activeUploads.map(upload => (
              <div key={upload.id} className={s.trackerItem}>
                <span className={s.trackerName} title={upload.name}>
                  {upload.name}
                </span>
                <div className={s.trackerStatus}>
                  {upload.status === 'uploading' && (
                    <div className={s.progressBar}>
                      <div
                        className={s.progressFill}
                        style={{ '--progress-width': `${upload.progress}%` }}
                      />
                    </div>
                  )}
                  {upload.status === 'completed' && (
                    <span className={s.successText}>
                      {t('files:uploader.done', 'Done')}
                    </span>
                  )}
                  {upload.status === 'error' && (
                    <span className={s.errorText}>
                      {t('files:uploader.failed', 'Failed')}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export default FileUploader;
