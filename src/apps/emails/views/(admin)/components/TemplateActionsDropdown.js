/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { DotsVerticalIcon } from '@radix-ui/react-icons';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import ContextMenu from '@shared/renderer/components/ContextMenu';

/**
 * TemplateActionsDropdown - Standardized dropdown menu for email template actions
 */
function TemplateActionsDropdown({ template, onPreview, onDuplicate }) {
  const { t } = useTranslation();

  return (
    <ContextMenu>
      <ContextMenu.Trigger
        title={t('admin:common.moreActions', 'More actions')}
        className='rt-IconButton'
      >
        <DotsVerticalIcon width={16} height={16} />
      </ContextMenu.Trigger>
      <ContextMenu.Menu>
        <ContextMenu.Item
          onClick={() => onPreview(template)}
          icon='EyeOpenIcon'
          permission='emails:read'
        >
          {t('admin:emails.list.preview', 'Preview')}
        </ContextMenu.Item>
        <ContextMenu.Item
          onClick={() => onDuplicate(template)}
          icon='CopyIcon'
          permission='emails:create'
        >
          {t('admin:emails.list.duplicate', 'Duplicate')}
        </ContextMenu.Item>
      </ContextMenu.Menu>
    </ContextMenu>
  );
}

TemplateActionsDropdown.propTypes = {
  template: PropTypes.object.isRequired,
  onPreview: PropTypes.func.isRequired,
  onDuplicate: PropTypes.func.isRequired,
};

export default TemplateActionsDropdown;
