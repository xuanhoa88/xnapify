/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useCallback } from 'react';

import { Button, Flex, Text, Box } from '@radix-ui/themes';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import ContextMenu from '../ContextMenu';
import Icon from '../Icon';

import s from './TableBulkActions.css';

/**
 * BulkActionsBar - Floating action bar when table rows are selected
 */
function TableBulkActions({
  count,
  itemCountLabel,
  actions = [],
  moreActions = [],
  onClear,
}) {
  const { t } = useTranslation();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const displayItemCountLabel =
    itemCountLabel ||
    t('shared:components.bulkActions.itemsSelected', 'items selected');

  const handleMoreToggle = useCallback(isOpen => {
    setIsMoreOpen(isOpen);
  }, []);

  if (count <= 0) return null;

  return (
    <Flex
      align='center'
      justify='between'
      px='4'
      py='2'
      className={s.bulkBarContainer}
    >
      <Flex align='center' gap='2'>
        <Box className={s.bulkCountBadge}>{count}</Box>
        <Text size='2' weight='medium' className={s.bulkItemCountText}>
          {displayItemCountLabel}
        </Text>
      </Flex>

      <Flex align='center' gap='2' className={s.bulkActionsFlex}>
        {actions
          .filter(Boolean)
          .slice(0, 3)
          .map((action, index) => (
            <Button
              key={action.label || index}
              variant={action.variant === 'danger' ? 'danger' : 'ghost'}
              size='small'
              onClick={action.onClick}
              className={s.bulkActionButton}
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
          >
            <ContextMenu.Trigger
              title={t(
                'shared:components.bulkActions.moreActions',
                'More actions',
              )}
              className={s.bulkMoreTrigger}
            >
              <Icon name='DotsVerticalIcon' size={16} />
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
      </Flex>
      <Button
        variant='ghost'
        size='small'
        onClick={onClear}
        className={s.bulkClearButton}
      >
        <Icon name='Cross1Icon' size={14} />
        {t('shared:components.bulkActions.clear', 'Clear')}
      </Button>
    </Flex>
  );
}

TableBulkActions.propTypes = {
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

export default TableBulkActions;
