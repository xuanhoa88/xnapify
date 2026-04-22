/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useMemo, useCallback } from 'react';

import { Button, Flex, Text } from '@radix-ui/themes';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import s from './TablePagination.css';

/**
 * Pagination - Reusable pagination component for tables/lists
 *
 * Props:
 *   @param {number} currentPage - Current active page (1-indexed)
 *   @param {number} totalPages - Total number of pages
 *   @param {number} totalItems - Total number of items (optional, for info display)
 *   @param {function} onPageChange - Callback when page changes
 *   @param {boolean} loading - Disable buttons when loading
 *   @param {boolean} showInfo - Show "X total · Page Y of Z" info
 *   @param {string} prevLabel - Label for previous button
 *   @param {string} nextLabel - Label for next button
 */
function TablePagination({
  currentPage,
  totalPages,
  totalItems,
  onPageChange,
  loading = false,
  showInfo = true,
  prevLabel,
  nextLabel,
}) {
  const { t } = useTranslation();

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

  // Don't render if only one page
  if (totalPages <= 1) {
    return null;
  }

  return (
    <Flex
      align='center'
      justify='between'
      width='100%'
      px='4'
      py='3'
      className={s.paginationContainer}
    >
      {showInfo && totalItems != null && (
        <Text size='2' color='gray'>
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

      <Flex
        align='center'
        gap='2'
        className={showInfo ? s.paginationControlsAuto : s.paginationControls}
      >
        <Button
          variant='ghost'
          size='small'
          onClick={handlePrev}
          disabled={currentPage === 1 || loading}
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
                size='1'
                onClick={() => handlePageClick(page)}
                disabled={loading}
                className={clsx(s.paginationPageButton, {
                  [s.paginationPageButtonCurrent]: currentPage === page,
                })}
              >
                {page}
              </Button>
            ),
          )}
        </Flex>

        <Button
          variant='ghost'
          size='small'
          onClick={handleNext}
          disabled={currentPage >= totalPages || loading}
        >
          {displayNextLabel}
        </Button>
      </Flex>
    </Flex>
  );
}

TablePagination.propTypes = {
  currentPage: PropTypes.number.isRequired,
  totalPages: PropTypes.number.isRequired,
  totalItems: PropTypes.number,
  onPageChange: PropTypes.func.isRequired,
  loading: PropTypes.bool,
  showInfo: PropTypes.bool,
  prevLabel: PropTypes.string,
  nextLabel: PropTypes.string,
};

export default TablePagination;
