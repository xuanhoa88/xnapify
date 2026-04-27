/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useEffect, useRef, useState, useCallback } from 'react';

import { FileTextIcon, UploadIcon } from '@radix-ui/react-icons';
import { Box, Flex, Text } from '@radix-ui/themes';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { v4 as uuidv4 } from 'uuid';

import { PageHeader } from '@shared/renderer/components/PageHeader';

import FileGrid from '../components/FileGrid';
import FileSidebar from '../components/FileSidebar';
import FileToolbar from '../components/FileToolbar';
import ShareModal from '../components/ShareModal';
import {
  fetchFiles,
  uploadFile,
  addUploadItem,
  updateUploadProgress,
  selectCurrentView,
  selectCurrentFolderId,
  selectSearch,
  selectPage,
  selectPageSize,
} from '../redux';

import s from './Files.css';

/**
 * Files Page
 *
 * The main container for the Google Drive-like file manager in the admin panel.
 */
function Files() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const currentView = useSelector(selectCurrentView);
  const currentFolderId = useSelector(selectCurrentFolderId);
  const search = useSelector(selectSearch);
  const page = useSelector(selectPage);
  const pageSize = useSelector(selectPageSize);
  const shareModalRef = useRef(null);

  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  // Initial fetch and fetch on view/folder/search/pagination change
  useEffect(() => {
    dispatch(
      fetchFiles({
        view: currentView,
        parentId: currentFolderId,
        search,
        page,
        pageSize,
      }),
    );
  }, [dispatch, currentView, currentFolderId, search, page, pageSize]);

  const handleDragEnter = useCallback(e => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback(e => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback(e => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    async e => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      dragCounter.current = 0;

      const { files } = e.dataTransfer;
      if (!files || files.length === 0) return;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const uploadId = uuidv4();

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
            dispatch(
              fetchFiles({ view: currentView, parentId: currentFolderId }),
            );
          } else {
            dispatch(
              updateUploadProgress({
                id: uploadId,
                status: 'error',
                error: resultAction.payload || 'Upload failed',
              }),
            );
          }
        } catch (err) {
          dispatch(
            updateUploadProgress({
              id: uploadId,
              status: 'error',
              error: err.message,
            }),
          );
        }
      }
    },
    [dispatch, currentFolderId, currentView],
  );

  return (
    <Box
      className={clsx(s.container, { [s.isDragging]: isDragging })}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {isDragging && (
        <Flex
          direction='column'
          align='center'
          justify='center'
          className={s.dragOverlay}
        >
          <Box className={s.dragOverlayContent}>
            <UploadIcon width={48} height={48} className={s.dragOverlayIcon} />
            <Text size='4' weight='bold' className={s.dragOverlayText}>
              {t('files:uploader.drop_to_upload', 'Drop files to upload')}
            </Text>
          </Box>
        </Flex>
      )}

      <PageHeader
        title={t('admin:files.title', 'File Management')}
        subtitle={t(
          'admin:files.subtitle',
          'Manage digital assets, documents, and media',
        )}
        icon={<FileTextIcon width={24} height={24} />}
      />

      <Flex className={s.mainFlex}>
        {/* Left Sidebar Pane */}
        <Box className={s.sidebarBox}>
          <FileSidebar />
        </Box>

        {/* Right Main Content Pane */}
        <Flex direction='column' className={s.contentFlex}>
          <Box className={s.toolbarBox}>
            <FileToolbar />
          </Box>

          {/* Scrollable Area for Files */}
          <Box className={s.gridBox}>
            <FileGrid
              onShare={file => {
                if (shareModalRef.current) shareModalRef.current.open(file);
              }}
            />
          </Box>
        </Flex>
      </Flex>

      {/* Absolute positioned uploader / modal */}
      <ShareModal ref={shareModalRef} />
    </Box>
  );
}

Files.propTypes = {};

export default Files;
