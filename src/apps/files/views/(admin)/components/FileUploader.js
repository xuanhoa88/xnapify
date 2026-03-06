/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { v4 as uuidv4 } from 'uuid';
import {
  Icon,
  ConfirmModal,
} from '../../../../../shared/renderer/components/Admin';
import Button from '../../../../../shared/renderer/components/Button';
import { validateForm } from '../../../../../shared/validator';
import { createFolderFormSchema } from '../../../validator/admin/file';
import {
  setUploadModalOpen,
  addUploadItem,
  updateUploadProgress,
  clearCompletedUploads,
  createFolder,
  fetchFiles,
  uploadFile,
  selectUploadModalOpen,
  selectCurrentFolderId,
  selectCurrentView,
  selectActiveUploads,
} from '../redux';
import s from './FileUploader.css';

function FileUploader() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const isOpen = useSelector(selectUploadModalOpen);
  const currentFolderId = useSelector(selectCurrentFolderId);
  const currentView = useSelector(selectCurrentView);
  const activeUploads = useSelector(selectActiveUploads);

  const fileInputRef = useRef(null);
  const promptRef = useRef(null);

  // Trigger modal open from Redux state changes
  useEffect(() => {
    if (isOpen && promptRef.current) {
      promptRef.current.open({
        title: t('files:uploader.new_folder', 'New folder'),
        defaultValue: t('files:uploader.untitled_folder', 'Untitled folder'),
      });
      // Immediately reset redux state so it can be re-triggered
      dispatch(setUploadModalOpen(false));
    }
  }, [isOpen, dispatch, t]);

  const handleCreateFolder = async folderName => {
    // Client-side validation using Zod
    const [isValid, errors] = validateForm(createFolderFormSchema, {
      name: folderName,
      parentId: currentFolderId,
    });

    if (!isValid) {
      // Return error in the format ConfirmModal.Prompt expects
      return {
        success: false,
        error:
          (errors.name && errors.name[0]) ||
          t('files:uploader.invalid_name', 'Invalid folder name'),
      };
    }

    try {
      const result = await dispatch(
        createFolder({ name: folderName.trim(), parentId: currentFolderId }),
      ).unwrap();
      return result;
    } catch (err) {
      return {
        success: false,
        error:
          err.message ||
          t('files:uploader.create_failed', 'Failed to create folder'),
      };
    }
  };

  const handleFileChange = async e => {
    const { files } = e.target;
    if (!files || files.length === 0) return;

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
        id='hidden-file-upload'
        type='file'
        ref={fileInputRef}
        className={s.hiddenInput}
        onChange={handleFileChange}
        multiple
      />

      {/* NEW FOLDER DIALOG */}
      <ConfirmModal.Prompt
        ref={promptRef}
        onSubmit={handleCreateFolder}
        onSuccess={() => {
          /* Success handled explicitly if needed */
        }}
      />

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
