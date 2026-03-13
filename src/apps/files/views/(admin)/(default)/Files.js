/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useEffect, useRef } from 'react';

import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import * as Box from '@shared/renderer/components/Box';
import Icon from '@shared/renderer/components/Icon';

import FileGrid from '../components/FileGrid';
import FileSidebar from '../components/FileSidebar';
import FileToolbar from '../components/FileToolbar';
import ShareModal from '../components/ShareModal';
import {
  fetchFiles,
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

  return (
    <div className={s.root}>
      <Box.Header
        icon={<Icon name='folder' size={24} />}
        title={t('files:page.title', 'Files')}
        subtitle={t('files:page.subtitle', 'Manage your files and folders')}
      />
      <div className={s.filesAppContainer}>
        {/* Left Sidebar Pane */}
        <div className={s.sidebarPane}>
          <FileSidebar />
        </div>

        {/* Right Main Content Pane */}
        <div className={s.mainPane}>
          <FileToolbar />

          {/* Scrollable Area for Files */}
          <div className={s.contentArea}>
            <FileGrid
              onShare={file => {
                if (shareModalRef.current) shareModalRef.current.open(file);
              }}
            />
          </div>
        </div>
      </div>

      {/* Absolute positioned uploader / modal */}
      <ShareModal ref={shareModalRef} />
    </div>
  );
}

Files.propTypes = {};

export default Files;
