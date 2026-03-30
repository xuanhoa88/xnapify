/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useCallback } from 'react';

import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import Button from '../../Button';
import ContextMenu from '../../ContextMenu';
import Icon from '../../Icon';

import s from './BulkActionsBar.css';

/**
 * Reusable bulk actions bar component for table selection actions.
 *
 * @param {object} props - Component props
 * @param {number} props.count - Number of selected items
 * @param {string} [props.itemCountLabel] - Custom i18n key for the selection message
 * @param {Array<{label: string, onClick: Function, icon?: string, variant?: 'default'|'danger'}>} props.actions - Primary action buttons
 * @param {Array<{label: string, onClick: Function, icon?: ReactNode, variant?: 'danger'|'warning'}>} [props.moreActions] - Secondary actions in dropdown
 * @param {Function} props.onClear - Clear selection callback
 */
function BulkActionsBar({
  count,
  itemCountLabel,
  actions,
  moreActions,
  onClear,
}) {
  const { t } = useTranslation();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const handleMoreToggle = useCallback(value => {
    if (typeof value === 'function') {
      setIsMoreOpen(prev => Boolean(value(prev)));
    } else {
      setIsMoreOpen(Boolean(value));
    }
  }, []);

  return (
    <div className={s.bulkActions}>
      <span className={s.bulkInfo}>
        {t(itemCountLabel || 'shared:components.bulkActions.itemSelected', {
          count,
          defaultValue_one: '{{count}} item selected',
          defaultValue_other: '{{count}} items selected',
        })}
      </span>
      <div className={s.actionButtons}>
        {Array.isArray(actions) &&
          actions.map(action => (
            <Button
              key={action.label}
              variant='unstyled'
              size='small'
              className={
                action.variant === 'danger' ? s.dangerButton : s.actionButton
              }
              onClick={action.onClick}
            >
              {action.icon && <Icon name={action.icon} size={14} />}
              {action.label}
            </Button>
          ))}
        {Array.isArray(moreActions) && moreActions.length > 0 && (
          <ContextMenu
            isOpen={isMoreOpen}
            onToggle={handleMoreToggle}
            align='left'
            className={s.moreDropdown}
          >
            <ContextMenu.Trigger
              className={s.moreButton}
              title={t(
                'shared:components.bulkActions.moreActions',
                'More actions',
              )}
            >
              <Icon name='more-vertical' size={16} />
            </ContextMenu.Trigger>
            <ContextMenu.Menu>
              {moreActions.map((action, index) =>
                action.type === 'divider' ? (
                  <ContextMenu.Divider key={`divider-${index}`} />
                ) : (
                  <ContextMenu.Item
                    key={action.label}
                    onClick={action.onClick}
                    icon={action.icon}
                    variant={action.variant}
                  >
                    {action.label}
                  </ContextMenu.Item>
                ),
              )}
            </ContextMenu.Menu>
          </ContextMenu>
        )}
      </div>
      <Button
        variant='unstyled'
        size='small'
        className={s.clearButton}
        onClick={onClear}
      >
        <Icon name='close' size={14} />
        {t('shared:components.bulkActions.clear', 'Clear')}
      </Button>
    </div>
  );
}

BulkActionsBar.propTypes = {
  count: PropTypes.number.isRequired,
  itemCountLabel: PropTypes.string,
  actions: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      onClick: PropTypes.func.isRequired,
      icon: PropTypes.string,
      variant: PropTypes.oneOf(['default', 'danger']),
    }),
  ).isRequired,
  moreActions: PropTypes.arrayOf(
    PropTypes.oneOfType([
      // Action item
      PropTypes.shape({
        label: PropTypes.string.isRequired,
        onClick: PropTypes.func.isRequired,
        icon: PropTypes.node,
        variant: PropTypes.oneOf(['danger', 'warning']),
      }),
      // Divider item
      PropTypes.shape({
        type: PropTypes.oneOf(['divider']).isRequired,
      }),
    ]),
  ),
  onClear: PropTypes.func.isRequired,
};

export default BulkActionsBar;
