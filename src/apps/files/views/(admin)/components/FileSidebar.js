import { useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { useDispatch, useSelector } from 'react-redux';
import Icon from '../../../../../shared/renderer/components/Icon';
import Button from '../../../../../shared/renderer/components/Button';
import ContextMenu from '../../../../../shared/renderer/components/ContextMenu';
import {
  setView,
  setUploadModalOpen,
  selectCurrentView,
  fetchStorageUsage,
} from '../redux';
import FileUploader from './FileUploader';
import s from './FileSidebar.css';

const NAV_ITEMS = [
  { id: 'my_drive', label: 'sidebar.my_drive', icon: 'hard-drive' },
  { id: 'shared_with_me', label: 'sidebar.shared_with_me', icon: 'users' },
  { id: 'recent', label: 'sidebar.recent', icon: 'clock' },
  { id: 'starred', label: 'sidebar.starred', icon: 'star' },
  { id: 'trash', label: 'sidebar.trash', icon: 'trash' },
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
    <div className={s.sidebar}>
      <div className={s.newButtonContainer}>
        <ContextMenu align='left'>
          <ContextMenu.Trigger as={Button} variant='primary' fullWidth>
            <Icon name='plus' size={24} />
            {t('files:sidebar.new', 'New')}
          </ContextMenu.Trigger>
          <ContextMenu.Menu>
            <ContextMenu.Item
              icon={<Icon name='folder' size={18} />}
              onClick={() => dispatch(setUploadModalOpen(true))}
            >
              {t('files:uploader.new_folder', 'New folder')}
            </ContextMenu.Item>
            <ContextMenu.Divider />
            <ContextMenu.Item
              icon={<Icon name='upload' size={18} />}
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
      </div>

      <nav className={s.navMenu}>
        {NAV_ITEMS.map(item => (
          <Button
            key={item.id}
            variant='ghost'
            className={clsx(s.navItem, { [s.active]: currentView === item.id })}
            onClick={() => handleNavClick(item.id)}
          >
            <div className={s.navIconWrapper}>
              <Icon name={item.icon} size={20} />
            </div>
            <span className={s.navLabel}>{t(`files:${item.label}`)}</span>
          </Button>
        ))}
      </nav>

      {/* Storage Quota */}
      <div className={s.storageWidget}>
        <div className={s.storageBar}>
          <div
            className={s.storageFill}
            style={{ '--fill-width': `${percentage}%` }}
          />
        </div>
        <div className={s.storageText}>
          {t('files:sidebar.storage', {
            used: usedDisplay,
            total: totalDisplay,
          })}
        </div>
      </div>
    </div>
  );
}
