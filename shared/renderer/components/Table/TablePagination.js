/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useMemo, useCallback } from 'react';

import { CaretDownIcon, CheckIcon } from '@radix-ui/react-icons';
import { Button, Flex, Text, Box } from '@radix-ui/themes';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import ContextMenu from '../ContextMenu';

import s from './TablePagination.css';

/**
 * Pagination - Reusable pagination component for tables/lists
 *
 * Supports both explicit totalPages and computed totalPages from total + pageSize.
 * Optionally renders a page-size selector dropdown.
 *
 * Props:
 *   @param {number} currentPage - Current active page (1-indexed)
 *   @param {number} [totalPages] - Total number of pages (explicit)
 *   @param {number} [totalItems] - Total number of items (for info display and computing pages)
 *   @param {number} [pageSize] - Items per page (used to compute totalPages from totalItems)
 *   @param {number[]} [pageSizeOptions] - Available page sizes for the selector
 *   @param {function} onPageChange - Callback when page changes
 *   @param {function} [onPageSizeChange] - Callback when page size changes
 *   @param {boolean} loading - Disable buttons when loading
 *   @param {boolean} showInfo - Show "X total · Page Y of Z" info
 *   @param {string} prevLabel - Label for previous button
 *   @param {string} nextLabel - Label for next button
 */
function TablePagination({
  currentPage,
  totalPages: totalPagesProp,
  totalItems,
  pageSize,
  pageSizeOptions,
  onPageChange,
  onPageSizeChange,
  loading = false,
  showInfo = true,
  prevLabel,
  nextLabel,
  className,
}) {
  const { t } = useTranslation();

  // Compute totalPages: explicit prop takes priority, then derive from total + pageSize
  const totalPages =
    totalPagesProp ||
    (totalItems != null && pageSize ? Math.ceil(totalItems / pageSize) : 1);

  const displayPrevLabel =
    prevLabel || t('shared:components.table.pagination.prev', '‹ Prev');
  const displayNextLabel =
    nextLabel || t('shared:components.table.pagination.next', 'Next ›');

  // Generate page numbers with ellipsis
  const pageNumbers = useMemo(() => {
    const pages = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else if (currentPage <= 3) {
      for (let i = 1; i <= 4; i++) pages.push(i);
      pages.push('...');
      pages.push(totalPages);
    } else if (currentPage >= totalPages - 2) {
      pages.push(1);
      pages.push('...');
      for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      pages.push('...');
      for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
      pages.push('...');
      pages.push(totalPages);
    }

    return pages;
  }, [currentPage, totalPages]);

  const handlePrev = useCallback(() => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  }, [currentPage, onPageChange]);

  const handleNext = useCallback(() => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  }, [currentPage, totalPages, onPageChange]);

  const handlePageClick = useCallback(
    page => {
      if (page !== currentPage) {
        onPageChange(page);
      }
    },
    [currentPage, onPageChange],
  );

  const handlePageSizeChange = useCallback(
    size => {
      if (onPageSizeChange) {
        onPageSizeChange(Number(size));
      }
    },
    [onPageSizeChange],
  );

  return (
    <Flex
      align='center'
      justify='between'
      wrap='wrap'
      gap='3'
      width='100%'
      px='4'
      py='3'
      className={clsx(s.paginationContainer, className)}
    >
      <Flex align='center' gap='3' wrap='wrap'>
        {showInfo && totalItems != null && (
          <Text size='2' color='gray' className={s.paginationInfo}>
            {t(
              'shared:components.table.pagination.info',
              '{{total}} total · Page {{current}} of {{pages}}',
              {
                total: totalItems,
                current: currentPage,
                pages: totalPages,
              },
            )}
          </Text>
        )}

        {/* Page size selector */}
        {pageSizeOptions && pageSizeOptions.length > 0 && onPageSizeChange && (
          <Flex align='center' gap='2'>
            <ContextMenu modal={false}>
              <ContextMenu.Trigger asChild disabled={loading}>
                <button type='button' className={s.pageSizeTrigger}>
                  <span>
                    {t(
                      'shared:components.table.pagination.pageSize',
                      '{{pageSize}} / page',
                      { pageSize },
                    )}
                  </span>
                  <Box className='flex text-[var(--gray-9)]'>
                    <CaretDownIcon width={12} height={12} />
                  </Box>
                </button>
              </ContextMenu.Trigger>
              <ContextMenu.Menu
                align='center'
                sideOffset={4}
                className='border border-[var(--gray-a4)] rounded-md shadow-md overflow-hidden p-1'
              >
                {pageSizeOptions.map(size => (
                  <ContextMenu.Item
                    key={size}
                    onClick={() => handlePageSizeChange(size)}
                    className={clsx(
                      pageSize === size &&
                        'bg-[var(--indigo-9)] text-white hover:bg-[var(--indigo-10)]',
                    )}
                  >
                    <Flex align='center' gap='2' width='100%'>
                      <Box width='16px' className='flex items-center'>
                        {pageSize === size && (
                          <CheckIcon width={16} height={16} />
                        )}
                      </Box>
                      <Text
                        size='2'
                        className={clsx(pageSize === size && 'text-white')}
                      >
                        {t(
                          'shared:components.table.pagination.page',
                          '{{size}} / page',
                          { size },
                        )}
                      </Text>
                    </Flex>
                  </ContextMenu.Item>
                ))}
              </ContextMenu.Menu>
            </ContextMenu>
          </Flex>
        )}
      </Flex>

      <Flex
        align='center'
        gap='2'
        className={showInfo ? s.paginationControlsAuto : s.paginationControls}
      >
        <Button
          variant='ghost'
          size='2'
          onClick={handlePrev}
          disabled={currentPage === 1 || loading}
          className='cursor-pointer'
        >
          {displayPrevLabel}
        </Button>

        <Flex align='center' gap='1'>
          {pageNumbers.map((page, idx) =>
            page === '...' ? (
              <Text key={`ellipsis-${idx}`} size='2' color='gray' px='2'>
                ...
              </Text>
            ) : (
              <Button
                key={page}
                variant={currentPage === page ? 'soft' : 'ghost'}
                color={currentPage === page ? 'indigo' : 'gray'}
                size='2'
                onClick={() => handlePageClick(page)}
                disabled={loading}
                className={clsx(
                  s.paginationPageButton,
                  currentPage === page && s.paginationPageButtonCurrent,
                  'flex items-center justify-center font-medium transition-colors',
                  currentPage !== page && 'hover:bg-[var(--gray-3)]',
                )}
              >
                {page}
              </Button>
            ),
          )}
        </Flex>

        <Button
          variant='ghost'
          size='2'
          onClick={handleNext}
          disabled={currentPage >= totalPages || loading}
          className='cursor-pointer'
        >
          {displayNextLabel}
        </Button>
      </Flex>
    </Flex>
  );
}

TablePagination.propTypes = {
  currentPage: PropTypes.number.isRequired,
  totalPages: PropTypes.number,
  totalItems: PropTypes.number,
  pageSize: PropTypes.number,
  pageSizeOptions: PropTypes.arrayOf(PropTypes.number),
  onPageChange: PropTypes.func.isRequired,
  onPageSizeChange: PropTypes.func,
  loading: PropTypes.bool,
  showInfo: PropTypes.bool,
  prevLabel: PropTypes.string,
  nextLabel: PropTypes.string,
  className: PropTypes.string,
};

export default TablePagination;
