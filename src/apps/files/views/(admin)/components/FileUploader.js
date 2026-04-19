/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useRef, useEffect, useCallback } from 'react';

import {
  Cross2Icon,
  CheckCircledIcon,
  InfoCircledIcon,
} from '@radix-ui/react-icons';
import { Box, Flex, Text, Button } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { v4 as uuidv4 } from 'uuid';

import Modal from '@shared/renderer/components/Modal';
import { validateForm } from '@shared/validator';

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

  const handleCreateFolder = useCallback(
    async folderName => {
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
    },
    [currentFolderId, dispatch, t],
  );

  const handleFileChange = useCallback(
    async e => {
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
    },
    [currentFolderId, currentView, dispatch, t],
  );

  return (
    <>
      <Box
        as='input'
        id='hidden-file-upload'
        type='file'
        ref={fileInputRef}
        className={s.hiddenInput}
        onChange={handleFileChange}
        multiple
      />

      {/* NEW FOLDER DIALOG */}
      <Modal.ConfirmPrompt
        ref={promptRef}
        onSubmit={handleCreateFolder}
        onSuccess={() => {
          /* Success handled explicitly if needed */
        }}
      />

      {/* UPLOAD PROGRESS TRACKER (Bottom Right) */}
      {activeUploads.length > 0 && (
        <Box className={s.trackerContainer}>
          <Flex align='center' justify='between' className={s.trackerHeader}>
            <Text as='span' size='2' weight='bold' className={s.trackerTitle}>
              {t('files:uploader.uploads_status', {
                count: activeUploads.filter(u => u.status === 'completed')
                  .length,
                total: activeUploads.length,
              })}
            </Text>
            <Button
              variant='ghost'
              size='1'
              className={s.trackerCloseBtn}
              onClick={() => dispatch(clearCompletedUploads())}
            >
              <Cross2Icon width={16} height={16} />
            </Button>
          </Flex>
          <Box className={s.trackerList}>
            {activeUploads.map(upload => (
              <Flex
                key={upload.id}
                direction='column'
                className={s.trackerItem}
              >
                <Flex
                  align='center'
                  justify='between'
                  className={
                    upload.status === 'uploading'
                      ? s.trackerItemHeaderUploading
                      : s.trackerItemHeader
                  }
                >
                  <Text
                    as='span'
                    size='2'
                    className={s.trackerItemName}
                    title={upload.name}
                  >
                    {upload.name}
                  </Text>

                  {upload.status === 'completed' && (
                    <Text as='span' size='1' className={s.statusSuccess}>
                      <CheckCircledIcon width={12} height={12} />
                      {t('files:uploader.done', 'Done')}
                    </Text>
                  )}
                  {upload.status === 'error' && (
                    <Text as='span' size='1' className={s.statusError}>
                      <InfoCircledIcon width={12} height={12} />
                      {t('files:uploader.failed', 'Failed')}
                    </Text>
                  )}
                </Flex>

                {upload.status === 'uploading' && (
                  <Box className={s.progressTrack}>
                    <Box
                      className={s.progressFill}
                      // eslint-disable-next-line react/forbid-dom-props
                      style={{ width: `${upload.progress}%` }}
                    />
                  </Box>
                )}
              </Flex>
            ))}
          </Box>
        </Box>
      )}
    </>
  );
}

export default FileUploader;
