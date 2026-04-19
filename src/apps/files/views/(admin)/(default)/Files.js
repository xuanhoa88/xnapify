/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useEffect, useRef } from 'react';

import { ArchiveIcon } from '@radix-ui/react-icons';
import { Box, Flex, Heading } from '@radix-ui/themes';
import { useDispatch, useSelector } from 'react-redux';

// import { Flex, Heading, Text, Box } , Heading } from '@radix-ui/themes';
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
    <Box className={s.container}>
      <Flex
        align='center'
        justify='between'
        wrap='wrap'
        gap='4'
        className={s.header}
      >
        <Flex align='center' gap='3'>
          <Flex align='center' justify='center' className={s.iconBox}>
            <ArchiveIcon width={24} height={24} />
          </Flex>
          <Flex direction='column'>
            <Heading size='6' className={s.heading}>
              {null}
            </Heading>
          </Flex>
        </Flex>
      </Flex>

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
