/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { useDispatch, useSelector } from 'react-redux';
import { Icon } from '../../../../../shared/renderer/components/Admin';
import Button from '../../../../../shared/renderer/components/Button';
import FileUploader from './FileUploader';
import { setView, setUploadModalOpen } from '../redux';
import { selectCurrentView } from '../redux/selector';
import s from './FileSidebar.css';

const NAV_ITEMS = [
  { id: 'my_drive', label: 'sidebar.my_drive', icon: 'hard-drive' },
  { id: 'recent', label: 'sidebar.recent', icon: 'clock' },
  { id: 'starred', label: 'sidebar.starred', icon: 'star' },
  { id: 'trash', label: 'sidebar.trash', icon: 'trash' },
];

export default function FileSidebar() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const currentView = useSelector(selectCurrentView);

  const handleNavClick = viewId => {
    dispatch(setView({ view: viewId }));
  };

  const handleNewClick = () => {
    dispatch(setUploadModalOpen(true));
  };

  return (
    <div className={s.sidebar}>
      <div className={s.newButtonContainer}>
        <Button variant='primary' fullWidth onClick={handleNewClick}>
          <Icon name='plus' size={24} />
          {t('files:sidebar.new', 'New')}
        </Button>
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

      {/* Storage Quota placeholder - can be linked to real data later */}
      <div className={s.storageWidget}>
        <div className={s.storageBar}>
          <div className={s.storageFill} style={{ '--fill-width': '45%' }} />
        </div>
        <div className={s.storageText}>
          {t('files:sidebar.storage', { used: 45, total: 100 })}
        </div>
      </div>
    </div>
  );
}
