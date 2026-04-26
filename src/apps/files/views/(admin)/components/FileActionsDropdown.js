import {
  Pencil1Icon,
  Share1Icon,
  CopyIcon,
  DownloadIcon,
  StarIcon,
  TrashIcon,
  DotsVerticalIcon,
} from '@radix-ui/react-icons';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import ContextMenu from '@shared/renderer/components/ContextMenu';
import { features } from '@shared/renderer/redux';

import { selectCurrentView } from '../redux';

const { getUserId } = features;

export default function FileActionsDropdown({
  file,
  onRename,
  onShare,
  onCopyLink,
  onDownload,
  onStar,
  onTrash,
}) {
  const { t } = useTranslation();
  const currentUserId = useSelector(getUserId);
  const currentView = useSelector(selectCurrentView);

  return (
    <ContextMenu>
      <ContextMenu.Trigger variant='ghost' size='2'>
        <DotsVerticalIcon width={16} height={16} />
      </ContextMenu.Trigger>
      <ContextMenu.Menu>
        {file.owner_id === currentUserId && (
          <ContextMenu.Item
            icon={<Pencil1Icon width={16} height={16} />}
            onClick={() => onRename(file)}
          >
            {t('files:grid.rename', 'Rename')}
          </ContextMenu.Item>
        )}
        <ContextMenu.Item
          icon={<Share1Icon width={16} height={16} />}
          onClick={() => onShare(file)}
        >
          {t('files:grid.share', 'Share')}
        </ContextMenu.Item>

        <ContextMenu.Item
          icon={<CopyIcon width={16} height={16} />}
          onClick={() => onCopyLink(file)}
        >
          {t('files:grid.copy_link', 'Copy link')}
        </ContextMenu.Item>

        {file.type === 'file' && (
          <ContextMenu.Item
            icon={<DownloadIcon width={16} height={16} />}
            onClick={() => onDownload(file)}
          >
            {t('files:grid.download', 'Download')}
          </ContextMenu.Item>
        )}

        <ContextMenu.Item
          icon={<StarIcon width={16} height={16} />}
          onClick={() => onStar(file)}
        >
          {file.is_starred
            ? t('files:grid.remove_star', 'Remove Star')
            : t('files:grid.add_star', 'Add Star')}
        </ContextMenu.Item>

        {file.owner_id === currentUserId && (
          <>
            <ContextMenu.Divider />
            <ContextMenu.Item
              variant='danger'
              icon={<TrashIcon width={16} height={16} />}
              onClick={() => onTrash(file)}
            >
              {currentView === 'trash'
                ? t('files:grid.delete_permanently', 'Delete Permanently')
                : t('files:grid.move_to_trash', 'Move to Trash')}
            </ContextMenu.Item>
          </>
        )}
      </ContextMenu.Menu>
    </ContextMenu>
  );
}

FileActionsDropdown.propTypes = {
  file: PropTypes.object.isRequired,
  onRename: PropTypes.func.isRequired,
  onShare: PropTypes.func.isRequired,
  onCopyLink: PropTypes.func.isRequired,
  onDownload: PropTypes.func.isRequired,
  onStar: PropTypes.func.isRequired,
  onTrash: PropTypes.func.isRequired,
};
