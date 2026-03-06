/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import React from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { Icon } from '../../../../../shared/renderer/components/Admin';
import Button from '../../../../../shared/renderer/components/Button';
import {
  setView,
  setViewMode,
  selectCurrentView,
  selectBreadcrumbs,
  selectViewMode,
} from '../redux';
import s from './FileToolbar.css';

export default function FileToolbar() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const currentView = useSelector(selectCurrentView);
  const breadcrumbs = useSelector(selectBreadcrumbs);
  const viewMode = useSelector(selectViewMode);

  const handleBreadcrumbClick = crumb => {
    if (crumb.id === 'root' || crumb.id === currentView) {
      // Go back to absolute root of current view
      dispatch(setView({ view: currentView, folderId: null }));
    } else {
      // Go to specific folder
      dispatch(setView({ view: 'my_drive', folderId: crumb.id }));
    }
  };

  return (
    <div className={s.toolbar}>
      <div className={s.breadcrumbsContainer}>
        {breadcrumbs.map((crumb, index) => {
          const isLast = index === breadcrumbs.length - 1;
          return (
            <React.Fragment key={crumb.id}>
              {/* Separator icon (chevron right) */}
              {index > 0 && (
                <span className={s.separator}>
                  <Icon name='chevronRight' size={16} />
                </span>
              )}

              <Button
                variant='ghost'
                className={clsx(s.crumbBtn, {
                  [s.activeCrumb]: isLast,
                })}
                onClick={() => !isLast && handleBreadcrumbClick(crumb)}
                disabled={isLast}
              >
                {crumb.name}
              </Button>
            </React.Fragment>
          );
        })}
      </div>

      <div className={s.actionsContainer}>
        <div className={s.viewToggles}>
          <Button
            variant='ghost'
            className={clsx(s.iconBtn, {
              [s.active]: viewMode === 'list',
            })}
            onClick={() => dispatch(setViewMode('list'))}
            title={t('files:toolbar.list_view', 'List view')}
            iconOnly
          >
            <Icon name='list' size={20} />
          </Button>
          <Button
            variant='ghost'
            className={clsx(s.iconBtn, {
              [s.active]: viewMode === 'grid',
            })}
            onClick={() => dispatch(setViewMode('grid'))}
            title={t('files:toolbar.grid_view', 'Grid view')}
            iconOnly
          >
            <Icon name='dashboard' size={20} />
          </Button>
        </div>
      </div>
    </div>
  );
}
