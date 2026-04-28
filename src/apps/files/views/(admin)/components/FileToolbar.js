/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import React, { useCallback } from 'react';

import {
  ChevronRightIcon,
  ListBulletIcon,
  DashboardIcon,
} from '@radix-ui/react-icons';
import { Flex, Box, Button, SegmentedControl } from '@radix-ui/themes';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import { TableSearch } from '@shared/renderer/components/Table';

import {
  setView,
  setViewMode,
  selectCurrentView,
  selectBreadcrumbs,
  selectViewMode,
  selectSearch,
  setSearch,
} from '../redux';

import s from './FileToolbar.css';

export default function FileToolbar() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const currentView = useSelector(selectCurrentView);
  const breadcrumbs = useSelector(selectBreadcrumbs);
  const viewMode = useSelector(selectViewMode);
  const search = useSelector(selectSearch);

  const handleBreadcrumbClick = useCallback(
    crumb => {
      if (crumb.id === 'root' || crumb.id === currentView) {
        // Go back to absolute root of current view
        dispatch(setView({ view: currentView, folderId: null }));
      } else {
        // Go to specific folder
        dispatch(setView({ view: 'my_drive', folderId: crumb.id }));
      }
    },
    [currentView, dispatch],
  );

  return (
    <Flex
      align='center'
      justify='between'
      wrap='wrap'
      gap='3'
      className={s.toolbarContainer}
    >
      <Flex align='center' gap='1' className={s.breadcrumbFlex}>
        {breadcrumbs.map((crumb, index) => {
          const isLast = index === breadcrumbs.length - 1;
          return (
            <React.Fragment key={crumb.id}>
              {/* Separator icon (chevron right) */}
              {index > 0 && (
                <Box className={s.breadcrumbSeparator}>
                  <ChevronRightIcon width={16} height={16} />
                </Box>
              )}

              <Button
                variant='ghost'
                className={clsx(
                  s.breadcrumbBtn,
                  isLast ? s.breadcrumbBtnActive : s.breadcrumbBtnInactive,
                )}
                onClick={() => !isLast && handleBreadcrumbClick(crumb)}
                disabled={isLast}
              >
                {crumb.id !== 'root' &&
                  t(`files:sidebar.${crumb.id}`, crumb.name)}
                {crumb.id === 'root' && t('files:sidebar.my_drive', 'My Drive')}
              </Button>
            </React.Fragment>
          );
        })}
      </Flex>

      <Box className={s.searchBox}>
        <TableSearch
          value={search}
          onChange={val => dispatch(setSearch(val))}
          placeholder={t('files:toolbar.search_placeholder', 'Search files...')}
        />
      </Box>

      <Box className={s.viewToggleFlex}>
        <SegmentedControl.Root
          value={viewMode}
          onValueChange={val => dispatch(setViewMode(val))}
          size='2'
        >
          <SegmentedControl.Item
            value='list'
            title={t('files:toolbar.list_view', 'List view')}
          >
            <Flex align='center' justify='center' className='w-6 h-6'>
              <ListBulletIcon width={16} height={16} />
            </Flex>
          </SegmentedControl.Item>
          <SegmentedControl.Item
            value='grid'
            title={t('files:toolbar.grid_view', 'Grid view')}
          >
            <Flex align='center' justify='center' className='w-6 h-6'>
              <DashboardIcon width={16} height={16} />
            </Flex>
          </SegmentedControl.Item>
        </SegmentedControl.Root>
      </Box>
    </Flex>
  );
}
