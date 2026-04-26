import { useEffect, useCallback } from 'react';

import * as RadixIcons from '@radix-ui/react-icons';
import { Box, Flex, Text, Button } from '@radix-ui/themes';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import ContextMenu from '@shared/renderer/components/ContextMenu';

import {
  setView,
  setUploadModalOpen,
  selectCurrentView,
  fetchStorageUsage,
} from '../redux';

import FileUploader from './FileUploader';

import s from './FileSidebar.css';

const NAV_ITEMS = [
  { id: 'my_drive', label: 'sidebar.my_drive', icon: RadixIcons.FileTextIcon },
  {
    id: 'shared_with_me',
    label: 'sidebar.shared_with_me',
    icon: RadixIcons.PersonIcon,
  },
  { id: 'recent', label: 'sidebar.recent', icon: RadixIcons.ClockIcon },
  { id: 'starred', label: 'sidebar.starred', icon: RadixIcons.StarIcon },
  { id: 'trash', label: 'sidebar.trash', icon: RadixIcons.TrashIcon },
];

const formatStorage = bytes => {
  if (!bytes) return '0 GB';
  const mb = bytes / (1024 * 1024);
  if (mb < 100) return `${mb.toFixed(1)} MB`;
  const gb = bytes / (1024 * 1024 * 1024);
  return `${gb.toFixed(1)} GB`;
};

export default function FileSidebar() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const currentView = useSelector(selectCurrentView);
  const storage = useSelector(state => state.files.storage);

  useEffect(() => {
    dispatch(fetchStorageUsage());
  }, [dispatch]);

  const handleNavClick = useCallback(
    viewId => {
      dispatch(setView({ view: viewId }));
    },
    [dispatch],
  );

  const usedDisplay = formatStorage(storage.used);
  const totalDisplay = formatStorage(storage.total);

  const rawPercentage = (storage.used / storage.total) * 100;
  const percentage =
    storage.used > 0 ? Math.max(1, Math.round(rawPercentage)) : 0;

  return (
    <Box className={s.sidebarContainer}>
      <Box className={s.topBox}>
        <ContextMenu>
          <ContextMenu.Trigger asChild>
            <Button variant='solid' className={s.newBtn}>
              <RadixIcons.PlusIcon
                width={20}
                height={20}
                className={s.plusIcon}
              />
              {t('files:sidebar.new', 'New')}
            </Button>
          </ContextMenu.Trigger>
          <ContextMenu.Menu>
            <ContextMenu.Item
              icon={<RadixIcons.FileTextIcon width={18} height={18} />}
              onClick={() => dispatch(setUploadModalOpen(true))}
            >
              {t('files:uploader.new_folder', 'New folder')}
            </ContextMenu.Item>
            <ContextMenu.Divider />
            <ContextMenu.Item
              icon={<RadixIcons.UploadIcon width={18} height={18} />}
              onClick={() => {
                // Pass a signal to open file dialog natively
                const inputElement =
                  document.getElementById('hidden-file-upload');
                if (inputElement) {
                  inputElement.click();
                }
              }}
            >
              {t('files:uploader.file_upload', 'File upload')}
            </ContextMenu.Item>
          </ContextMenu.Menu>
        </ContextMenu>
        <FileUploader />
      </Box>

      <Flex as='nav' direction='column' gap='1' className={s.navBox}>
        {NAV_ITEMS.map(item => (
          <Button
            key={item.id}
            variant='ghost'
            className={clsx(
              s.navBtn,
              currentView === item.id ? s.navBtnActive : s.navBtnInactive,
            )}
            onClick={() => handleNavClick(item.id)}
          >
            <Flex align='center' justify='center' className={s.navIconBox}>
              {(() => {
                const Comp =
                  typeof item.icon === 'string'
                    ? RadixIcons.BoxIcon
                    : item.icon;
                return (
                  <Comp
                    width={18}
                    height={18}
                    className={
                      currentView === item.id
                        ? s.navIconActive
                        : s.navIconInactive
                    }
                  />
                );
              })()}
            </Flex>
            <Text as='span' size='2'>
              {t(`files:${item.label}`)}
            </Text>
          </Button>
        ))}
      </Flex>

      {/* Storage Quota */}
      <Box className={s.quotaBox}>
        <Box className={s.quotaTrack}>
          <Box
            className={clsx(
              s.quotaFill,
              percentage > 90 ? s.quotaFillDanger : s.quotaFillNormal,
            )}
            // eslint-disable-next-line react/forbid-dom-props
            style={{ width: `${percentage}%` }}
          />
        </Box>
        <Text as='div' size='1' color='gray' className={s.quotaText}>
          {t('files:sidebar.storage', {
            used: usedDisplay,
            total: totalDisplay,
          })}
        </Text>
      </Box>
    </Box>
  );
}
