/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  Children,
  isValidElement,
} from 'react';

import {
  ColumnsIcon,
  Cross2Icon,
  DashboardIcon,
  ExclamationTriangleIcon,
  TableIcon,
} from '@radix-ui/react-icons';
import {
  Box,
  Flex,
  Text,
  Table,
  Checkbox,
  Button,
  IconButton,
} from '@radix-ui/themes';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import Loader from '../Loader/index.js';
import { PageHeader } from '../PageHeader/index.js';

import TableBulkActions from './TableBulkActions.js';
import TablePagination from './TablePagination.js';
import TableSearch from './TableSearch.js';
import { useMasonryLayout } from './useMasonryLayout.js';

import s from './DataTable.css';

// ============================================================================
// Helpers
// ============================================================================

/**
 * Resolve a dot-path value from an object.
 * e.g. getNestedValue({ profile: { name: 'John' } }, 'profile.name') → 'John'
 */
function getNestedValue(obj, path) {
  if (!path || !obj) return undefined;
  const keys = path.split('.');
  let current = obj;
  for (const key of keys) {
    if (current == null) return undefined;
    current = current[key];
  }
  return current;
}

/**
 * Resolve the row key from a record.
 */
function resolveRowKey(record, rowKey) {
  if (typeof rowKey === 'function') return rowKey(record);
  return record[rowKey];
}

/**
 * Find all children matching a specific component type.
 */
function findSlot(children, SlotType) {
  const result = [];
  Children.forEach(children, child => {
    if (isValidElement(child) && child.type === SlotType) {
      result.push(child);
    }
  });
  return result;
}

/**
 * Find first child matching a specific component type.
 */
function findSlotOne(children, SlotType) {
  const slots = findSlot(children, SlotType);
  return slots.length > 0 ? slots[0] : null;
}

// ============================================================================
// Sub-components (compound component parts)
// ============================================================================

/**
 * DataTable.Header — Page header with icon, title, subtitle, and action slot.
 * Now wraps PageHeader to maintain backwards compatibility.
 *
 * @example
 * <DataTable.Header title="Users" subtitle="Manage users" icon={<GroupIcon />}>
 *   <Button>Add User</Button>
 * </DataTable.Header>
 */
function DataTableHeader(props) {
  return <PageHeader {...props} />;
}

DataTableHeader.displayName = 'DataTableHeader';

DataTableHeader.propTypes = {
  title: PropTypes.string,
  subtitle: PropTypes.string,
  icon: PropTypes.node,
  children: PropTypes.node,
};

/**
 * DataTable.Toolbar — Container for search, filters, and extras.
 * Simply renders children in a flat flex row — no slot-finding needed.
 *
 * @example
 * <DataTable.Toolbar>
 *   <DataTable.Search value={s} onChange={fn} />
 *   <DataTable.Filter component={Select} {...props} />
 * </DataTable.Toolbar>
 */
function DataTableToolbar({ justify = 'start', children }) {
  if (!children) return null;

  return (
    <Box className={s.toolbarBox}>
      <Flex gap='3' wrap='wrap' align='center' justify={justify}>
        {children}
      </Flex>
    </Box>
  );
}

DataTableToolbar.displayName = 'DataTableToolbar';

DataTableToolbar.propTypes = {
  justify: PropTypes.oneOf(['start', 'center', 'end', 'between', 'around']),
  children: PropTypes.node,
};

/**
 * DataTable.Filter — Renders a filter component with sizing.
 * Width controls the CSS class: 'search' | 'lg' | 'sm'.
 *
 * @example
 * <DataTable.Filter component={SearchableSelect} width="lg" options={opts} value={v} onChange={fn} />
 * <DataTable.Filter component={TableSearch} width="search" value={s} onChange={fn} />
 */
function DataTableFilter({
  component: FilterComp,
  width = 'lg',
  ...filterProps
}) {
  if (!FilterComp) return null;

  const widthClassMap = {
    search: s.toolbarSearch,
    lg: s.filterLg,
    md: s.filterMd,
    sm: s.filterSm,
  };

  return (
    <FilterComp
      className={widthClassMap[width] || s.filterLg}
      {...filterProps}
    />
  );
}

DataTableFilter.displayName = 'DataTableFilter';

DataTableFilter.propTypes = {
  component: PropTypes.elementType.isRequired,
  width: PropTypes.oneOf(['search', 'lg', 'md', 'sm']),
};

/**
 * DataTable.Search — Convenience shorthand for a search filter.
 * Internally renders DataTable.Filter with component=TableSearch and width='search'.
 *
 * @example
 * <DataTable.Search value={search} onChange={setSearch} placeholder="Search..." />
 */
function DataTableSearch(props) {
  return <DataTableFilter component={TableSearch} width='search' {...props} />;
}

DataTableSearch.displayName = 'DataTableSearch';

DataTableSearch.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func,
  placeholder: PropTypes.string,
  debounce: PropTypes.number,
};

/**
 * DataTable.ClearFilters — Conditional clear-all button.
 *
 * @example
 * <DataTable.ClearFilters visible={hasActive} onClick={handleClear} />
 */
function DataTableClearFilters({ visible, onClick }) {
  const { t } = useTranslation();

  if (!visible) return null;

  return (
    <Box className={s.clearFilterBox}>
      <Button
        variant='ghost'
        size='2'
        onClick={onClick}
        type='button'
        title={t('common:components.dataTable.clearFilters', 'Clear Filters')}
      >
        <Cross2Icon width={12} height={12} />
        {t('common:components.dataTable.clear', 'Clear Filters')}
      </Button>
    </Box>
  );
}

DataTableClearFilters.displayName = 'DataTableClearFilters';

DataTableClearFilters.propTypes = {
  visible: PropTypes.bool,
  onClick: PropTypes.func.isRequired,
};

/**
 * DataTable.ViewToggle — Table/grid/masonry view toggle.
 *
 * @example
 * <DataTable.ViewToggle as="table" onChange={setViewType} enableMasonry />
 */
function DataTableViewToggle({ as, onChange, enableMasonry }) {
  const { t } = useTranslation();

  if (!onChange) return null;

  return (
    <Flex className={s.viewToggle}>
      <IconButton
        variant={as === 'table' ? 'soft' : 'ghost'}
        color={as === 'table' ? 'indigo' : 'gray'}
        size='1'
        onClick={() => onChange('table')}
        title={t('common:components.dataTable.viewTable', 'Table view')}
      >
        <TableIcon width={14} height={14} />
      </IconButton>
      <IconButton
        variant={as === 'grid' ? 'soft' : 'ghost'}
        color={as === 'grid' ? 'indigo' : 'gray'}
        size='1'
        onClick={() => onChange('grid')}
        title={t('common:components.dataTable.viewGrid', 'Grid view')}
      >
        <DashboardIcon width={14} height={14} />
      </IconButton>
      {enableMasonry && (
        <IconButton
          variant={as === 'masonry' ? 'soft' : 'ghost'}
          color={as === 'masonry' ? 'indigo' : 'gray'}
          size='1'
          onClick={() => onChange('masonry')}
          title={t('common:components.dataTable.viewMasonry', 'Masonry view')}
        >
          <ColumnsIcon width={14} height={14} />
        </IconButton>
      )}
    </Flex>
  );
}

DataTableViewToggle.displayName = 'DataTableViewToggle';

DataTableViewToggle.propTypes = {
  as: PropTypes.oneOf(['table', 'grid', 'masonry']),
  onChange: PropTypes.func,
  enableMasonry: PropTypes.bool,
};

/**
 * DataTable.BulkActions — Floating command bar for bulk operations.
 * Wraps TableBulkActions with selection count from parent.
 *
 * @example
 * <DataTable.BulkActions
 *   actions={[{ label: 'Delete', onClick: fn }]}
 *   moreActions={[...]}
 *   label="items selected"
 * />
 */
function DataTableBulkActions({
  actions: _actions,
  moreActions: _moreActions,
  label: _label,
}) {
  // Marker component — rendered by DataTable root with injected count/onClear
  return null;
}

DataTableBulkActions.displayName = 'DataTableBulkActions';

DataTableBulkActions.propTypes = {
  actions: PropTypes.array,
  moreActions: PropTypes.array,
  label: PropTypes.string,
};

/**
 * DataTable.Empty — Empty state card.
 *
 * @example
 * <DataTable.Empty icon={<GroupIcon />} title="No data" description="Try again." />
 */
function DataTableEmpty({ icon, title, description, children }) {
  const { t } = useTranslation();

  return (
    <Flex
      justify='center'
      align='center'
      direction='column'
      py='9'
      px='4'
      className={s.emptyBlock}
    >
      {icon && <Box className={s.emptyIcon}>{icon}</Box>}
      <Text size='3' weight='bold' mb='1' align='center'>
        {title || t('common:components.dataTable.noData', 'No data found')}
      </Text>
      {description && (
        <Text size='2' color='gray' align='center'>
          {description}
        </Text>
      )}
      {children}
    </Flex>
  );
}

DataTableEmpty.displayName = 'DataTableEmpty';

DataTableEmpty.propTypes = {
  icon: PropTypes.node,
  title: PropTypes.string,
  description: PropTypes.string,
  children: PropTypes.node,
};

/**
 * DataTable.Error — Error state card with retry.
 *
 * @example
 * <DataTable.Error message={error} onRetry={retry} />
 */
function DataTableError({ message, onRetry }) {
  const { t } = useTranslation();

  if (!message) return null;

  return (
    <Flex
      direction='column'
      align='center'
      justify='center'
      p='6'
      className={s.errorBlock}
    >
      <ExclamationTriangleIcon width={32} height={32} color='var(--red-9)' />
      <Text color='red' size='4' weight='bold' mb='2' mt='3' align='center'>
        {t('common:components.dataTable.error', 'Error loading data')}
      </Text>
      <Text color='red' size='2' mb='4' align='center'>
        {message}
      </Text>
      {onRetry && (
        <Button variant='soft' color='red' onClick={onRetry} size='2'>
          {t('common:retry', 'Retry')}
        </Button>
      )}
    </Flex>
  );
}

DataTableError.displayName = 'DataTableError';

DataTableError.propTypes = {
  message: PropTypes.string,
  onRetry: PropTypes.func,
};

/**
 * DataTable.Loader — Loading skeleton or spinner.
 *
 * @example
 * <DataTable.Loader variant="skeleton" message="Loading..." />
 */
function DataTableLoader({ variant: _variant, message: _message }) {
  // Marker component — rendered by DataTable root based on loading state
  return null;
}

DataTableLoader.displayName = 'DataTableLoader';

DataTableLoader.propTypes = {
  variant: PropTypes.oneOf(['skeleton', 'spinner', 'cards']),
  message: PropTypes.string,
};

/**
 * DataTable.Pagination — Pagination with page size support.
 *
 * @example
 * <DataTable.Pagination
 *   current={page}
 *   total={100}
 *   pageSize={10}
 *   pageSizeOptions={[10, 20, 50]}
 *   onChange={setPage}
 *   onPageSizeChange={setPageSize}
 * />
 */
function DataTablePagination() {
  // Marker component — rendered by DataTable root
  return null;
}

DataTablePagination.displayName = 'DataTablePagination';

DataTablePagination.propTypes = {
  current: PropTypes.number,
  total: PropTypes.number,
  totalPages: PropTypes.number,
  pageSize: PropTypes.number,
  pageSizeOptions: PropTypes.arrayOf(PropTypes.number),
  onChange: PropTypes.func,
  onPageSizeChange: PropTypes.func,
};

// ============================================================================
// Main component
// ============================================================================

/**
 * DataTable — Compound component for data tables.
 *
 * Uses a composable children-based API instead of flat props.
 * Sub-components are discovered by displayName and rendered in the correct
 * layout order: Header → BulkActions → Toolbar → Table body → Pagination.
 *
 * @example
 * ```jsx
 * <DataTable columns={columns} dataSource={users} rowKey="id" loading={loading}>
 *   <DataTable.Header title="Users" subtitle="..." icon={<GroupIcon />}>
 *     <Button>Add User</Button>
 *   </DataTable.Header>
 *
 *   <DataTable.Toolbar>
 *     <DataTable.Search value={s} onChange={fn} placeholder="Search..." />
 *     <DataTable.Filter component={Select} width="lg" {...props} />
 *     <DataTable.ClearFilters visible={hasActive} onClick={handleClear} />
 *   </DataTable.Toolbar>
 *
 *   <DataTable.BulkActions actions={[...]} moreActions={[...]} />
 *   <DataTable.Empty icon={<Icon />} title="No data" description="..." />
 *   <DataTable.Error message={error} onRetry={fn} />
 *   <DataTable.Loader variant="skeleton" />
 *
 *   <DataTable.Pagination
 *     current={page}
 *     total={100}
 *     pageSize={10}
 *     onChange={setPage}
 *   />
 * </DataTable>
 * ```
 */
function DataTable({
  // Data
  columns,
  dataSource,
  rowKey,

  // View type
  as = 'table',
  renderCard,
  gridCols = 3,
  columnWidth = 240,

  // Infinite scroll (masonry)
  onLoadMore,
  hasMore,
  loadingMore,

  // Selection
  selectable,
  selectedKeys,
  onSelectionChange,
  onRowClick,
  onRowDoubleClick,

  // States
  loading,
  initialized = true,

  // Table variant
  variant = 'ghost',
  borderless = false,
  fillHeight = false,

  // Children (compound slots)
  children,
}) {
  const { t } = useTranslation();

  // ─── Discover slots from children ──────────────────────────────────
  const headerSlot = findSlotOne(children, DataTableHeader);
  const toolbarSlot = findSlotOne(children, DataTableToolbar);
  const bulkActionsSlot = findSlotOne(children, DataTableBulkActions);
  const emptySlot = findSlotOne(children, DataTableEmpty);
  const errorSlot = findSlotOne(children, DataTableError);
  const loaderSlot = findSlotOne(children, DataTableLoader);
  const paginationSlot = findSlotOne(children, DataTablePagination);

  // ─── Selection helpers ──────────────────────────────────────────────
  const isAllSelected =
    selectable &&
    dataSource &&
    dataSource.length > 0 &&
    selectedKeys &&
    selectedKeys.length === dataSource.length;

  const handleSelectAll = useCallback(
    checked => {
      if (!onSelectionChange || !dataSource) return;
      if (checked) {
        onSelectionChange(dataSource.map(r => resolveRowKey(r, rowKey)));
      } else {
        onSelectionChange([]);
      }
    },
    [onSelectionChange, dataSource, rowKey],
  );

  const handleSelectRow = useCallback(
    (id, checked) => {
      if (!onSelectionChange || !selectedKeys) return;
      if (checked) {
        onSelectionChange([...selectedKeys, id]);
      } else {
        onSelectionChange(selectedKeys.filter(k => k !== id));
      }
    },
    [onSelectionChange, selectedKeys],
  );

  const clearSelection = useCallback(() => {
    if (onSelectionChange) onSelectionChange([]);
  }, [onSelectionChange]);

  // ─── Visible columns (filter hidden) ───────────────────────────────
  const visibleColumns = useMemo(
    () => (columns || []).filter(col => !col.hidden),
    [columns],
  );

  // ─── Masonry layout ────────────────────────────────────────────────
  const {
    containerRef: masonryContainerRef,
    measureRef: masonryMeasureRef,
    positions: masonryPositions,
    containerHeight: masonryHeight,
    columnWidth: resolvedColumnWidth,
    isReady: masonryReady,
  } = useMasonryLayout({
    items: as === 'masonry' ? dataSource || [] : [],
    columnWidth: columnWidth,
  });

  // ─── Determine states ──────────────────────────────────────────────
  const isFirstLoad =
    !initialized || (loading && (!dataSource || dataSource.length === 0));
  const errorMessage = errorSlot && errorSlot.props.message;
  const hasError = !!errorMessage;
  const hasData = dataSource && dataSource.length > 0;
  const hasSelection = selectable && selectedKeys && selectedKeys.length > 0;

  // ─── Resolve pagination props ─────────────────────────────────────
  const paginationProps = paginationSlot ? paginationSlot.props : null;
  const resolvedTotalPages = paginationProps
    ? paginationProps.totalPages ||
      (paginationProps.total && paginationProps.pageSize
        ? Math.ceil(paginationProps.total / paginationProps.pageSize)
        : 1)
    : 0;
  const showPagination = !!paginationProps && as !== 'masonry';

  // ─── Infinite scroll sentinel for masonry ──────────────────────────
  const sentinelRef = useRef(null);

  useEffect(() => {
    if (as !== 'masonry' || !onLoadMore || !hasMore || loadingMore) {
      return undefined;
    }

    const sentinel = sentinelRef.current;
    const scrollRoot = masonryContainerRef.current;
    if (!sentinel || !scrollRoot) return undefined;

    const observer = new IntersectionObserver(
      function handleIntersect(entries) {
        if (entries[0] && entries[0].isIntersecting) {
          onLoadMore();
        }
      },
      { root: scrollRoot, rootMargin: '200px' },
    );

    observer.observe(sentinel);

    return function cleanupObserver() {
      observer.disconnect();
    };
  }, [as, onLoadMore, hasMore, loadingMore, masonryContainerRef]);

  // ─── Render ────────────────────────────────────────────────────────
  return (
    <>
      {/* Header — always visible */}
      {headerSlot}

      {/* Error state */}
      {!isFirstLoad && hasError && (
        <DataTableError
          message={errorMessage}
          onRetry={errorSlot.props.onRetry}
        />
      )}

      {/* Main content box */}
      {(!hasError || isFirstLoad) && (
        <Box
          className={clsx(
            'data-table-content',
            s.contentBox,
            { [s.borderless]: borderless },
            { [s.fillHeight]: fillHeight },
          )}
        >
          {isFirstLoad ? (
            <Loader
              variant={(loaderSlot && loaderSlot.props.variant) || 'skeleton'}
              message={
                (loaderSlot && loaderSlot.props.message) ||
                t('common:components.dataTable.loading', 'Loading...')
              }
              className={s.fillHeight}
            />
          ) : (
            <>
              {/* Bulk actions */}
              {hasSelection && bulkActionsSlot && (
                <TableBulkActions
                  count={selectedKeys.length}
                  itemCountLabel={bulkActionsSlot.props.label}
                  actions={bulkActionsSlot.props.actions || []}
                  moreActions={bulkActionsSlot.props.moreActions}
                  onClear={clearSelection}
                />
              )}

              {/* Toolbar */}
              {toolbarSlot}

              {/* Table view */}
              {as === 'table' ? (
                <Box className={clsx(s.tableWrapper, s.customScrollbar)}>
                  <Table.Root variant={variant}>
                    <Table.Header className='bg-[var(--color-panel-solid)]'>
                      <Table.Row>
                        {selectable && (
                          <Table.ColumnHeaderCell
                            className={clsx(s.checkboxCol, s.headerCell)}
                          >
                            <Checkbox
                              checked={isAllSelected}
                              onCheckedChange={handleSelectAll}
                            />
                          </Table.ColumnHeaderCell>
                        )}
                        {visibleColumns.map(col => (
                          <Table.ColumnHeaderCell
                            key={col.key}
                            className={clsx(s.headerCell, col.className)}
                            style={
                              col.width
                                ? { width: col.width, minWidth: col.width }
                                : undefined
                            }
                          >
                            {col.title}
                          </Table.ColumnHeaderCell>
                        ))}
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {hasData &&
                        dataSource.map((record, rowIndex) => {
                          const key = resolveRowKey(record, rowKey);
                          const isSelected =
                            selectable &&
                            selectedKeys &&
                            selectedKeys.includes(key);

                          return (
                            <Table.Row
                              key={key}
                              className={clsx(
                                isSelected && s.selectedRow,
                                (typeof onRowClick === 'function' ||
                                  typeof onRowDoubleClick === 'function') &&
                                  'cursor-pointer',
                              )}
                              onClick={
                                typeof onRowClick === 'function'
                                  ? () => onRowClick(record)
                                  : undefined
                              }
                              onDoubleClick={
                                typeof onRowDoubleClick === 'function'
                                  ? () => onRowDoubleClick(record)
                                  : undefined
                              }
                            >
                              {selectable && (
                                <Table.Cell
                                  className={clsx(s.checkboxCol, s.bodyCell)}
                                >
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={c =>
                                      handleSelectRow(key, c)
                                    }
                                  />
                                </Table.Cell>
                              )}
                              {visibleColumns.map(col => {
                                const value = getNestedValue(
                                  record,
                                  col.dataIndex,
                                );
                                return (
                                  <Table.Cell
                                    key={col.key}
                                    className={clsx(s.bodyCell, col.className)}
                                  >
                                    {col.render
                                      ? col.render(value, record, rowIndex)
                                      : value != null
                                        ? value
                                        : '—'}
                                  </Table.Cell>
                                );
                              })}
                            </Table.Row>
                          );
                        })}
                    </Table.Body>
                  </Table.Root>
                  {!hasData &&
                    (emptySlot || (
                      <DataTableEmpty
                        title={t(
                          'common:components.dataTable.noData',
                          'No data found',
                        )}
                      />
                    ))}
                </Box>
              ) : as === 'masonry' ? (
                <Box
                  className={clsx(s.masonryWrapper, s.customScrollbar)}
                  ref={masonryContainerRef}
                >
                  {hasData ? (
                    <>
                      {/* Hidden measurement container */}
                      <Box ref={masonryMeasureRef} className={s.masonryMeasure}>
                        {dataSource.map((record, rowIndex) => {
                          const key = resolveRowKey(record, rowKey);
                          return (
                            <Box
                              key={key}
                              className={s.masonryMeasureItem}
                              style={{
                                width: resolvedColumnWidth + 'px',
                              }}
                            >
                              {renderCard
                                ? renderCard(record, visibleColumns, rowIndex)
                                : JSON.stringify(record)}
                            </Box>
                          );
                        })}
                      </Box>

                      {/* Positioned masonry container */}
                      {masonryReady && (
                        <Box
                          className={s.masonryContainer}
                          style={{ height: masonryHeight + 'px' }}
                        >
                          {dataSource.map((record, rowIndex) => {
                            const key = resolveRowKey(record, rowKey);
                            const isSelected =
                              selectable &&
                              selectedKeys &&
                              selectedKeys.includes(key);
                            const pos = masonryPositions[rowIndex];

                            if (!pos) return null;

                            return (
                              <Box
                                key={key}
                                className={clsx(
                                  s.masonryItem,
                                  isSelected && s.selectedRow,
                                )}
                                style={{
                                  transform:
                                    'translateX(' +
                                    pos.left +
                                    'px) translateY(' +
                                    pos.top +
                                    'px)',
                                  width: pos.width + 'px',
                                }}
                              >
                                {selectable && (
                                  <Box className={s.gridCheckbox}>
                                    <Checkbox
                                      checked={isSelected}
                                      onCheckedChange={c =>
                                        handleSelectRow(key, c)
                                      }
                                    />
                                  </Box>
                                )}
                                {renderCard
                                  ? renderCard(record, visibleColumns, rowIndex)
                                  : JSON.stringify(record)}
                              </Box>
                            );
                          })}
                        </Box>
                      )}
                    </>
                  ) : (
                    emptySlot || (
                      <DataTableEmpty
                        title={t(
                          'common:components.dataTable.noData',
                          'No data found',
                        )}
                      />
                    )
                  )}

                  {/* Infinite scroll sentinel */}
                  {hasData && as === 'masonry' && hasMore && (
                    <Box ref={sentinelRef} className={s.masonrySentinel} />
                  )}

                  {/* Loading more indicator */}
                  {loadingMore && (
                    <Flex justify='center' align='center' py='4'>
                      <Loader variant='spinner' />
                    </Flex>
                  )}
                </Box>
              ) : (
                <Box className={clsx(s.gridWrapper, s.customScrollbar)}>
                  {hasData ? (
                    <Box
                      className={clsx(
                        s.gridContainer,
                        gridCols === 2 && s.gridCols2,
                        gridCols === 4 && s.gridCols4,
                        gridCols === 5 && s.gridCols5,
                        gridCols === 6 && s.gridCols6,
                      )}
                    >
                      {dataSource.map((record, rowIndex) => {
                        const key = resolveRowKey(record, rowKey);
                        const isSelected =
                          selectable &&
                          selectedKeys &&
                          selectedKeys.includes(key);

                        return (
                          <Box
                            key={key}
                            className={clsx(
                              s.gridItem,
                              isSelected && s.selectedRow,
                            )}
                          >
                            {selectable && (
                              <Box className={s.gridCheckbox}>
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={c => handleSelectRow(key, c)}
                                />
                              </Box>
                            )}
                            {renderCard
                              ? renderCard(record, visibleColumns, rowIndex)
                              : JSON.stringify(record)}
                          </Box>
                        );
                      })}
                    </Box>
                  ) : (
                    emptySlot || (
                      <DataTableEmpty
                        title={t(
                          'common:components.dataTable.noData',
                          'No data found',
                        )}
                      />
                    )
                  )}
                </Box>
              )}

              {/* Loading overlay */}
              {loading && hasData && (
                <Box className={s.loadingOverlay}>
                  <Loader variant='spinner' />
                </Box>
              )}
            </>
          )}

          {/* Pagination */}
          {showPagination && (
            <Box
              className={clsx(s.paginationBox, {
                [s.borderlessPaginationBox]: borderless,
              })}
            >
              <TablePagination
                className={clsx(borderless && s.borderlessPagination)}
                currentPage={paginationProps.current}
                totalPages={resolvedTotalPages}
                totalItems={paginationProps.total}
                pageSize={paginationProps.pageSize}
                pageSizeOptions={paginationProps.pageSizeOptions}
                onPageSizeChange={paginationProps.onPageSizeChange}
                onPageChange={paginationProps.onChange}
                loading={loading}
              />
            </Box>
          )}
        </Box>
      )}
    </>
  );
}

DataTable.propTypes = {
  // Data
  columns: function (props, propName, componentName) {
    if (props.as !== 'grid' && props.as !== 'masonry' && !props[propName]) {
      return new Error(
        `The prop \`${propName}\` is marked as required in \`${componentName}\` when \`as\` is 'table', but its value is \`undefined\`.`,
      );
    }
    if (props[propName]) {
      PropTypes.checkPropTypes(
        {
          [propName]: PropTypes.arrayOf(
            PropTypes.shape({
              key: PropTypes.string.isRequired,
              dataIndex: PropTypes.string,
              title: PropTypes.node,
              width: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
              order: PropTypes.number,
              align: PropTypes.oneOf(['left', 'center', 'right']),
              className: PropTypes.string,
              hidden: PropTypes.bool,
              render: PropTypes.func,
            }),
          ),
        },
        props,
        'prop',
        componentName,
      );
    }
    return null;
  },
  dataSource: PropTypes.array,
  rowKey: PropTypes.oneOfType([PropTypes.string, PropTypes.func]).isRequired,

  // View type
  as: PropTypes.oneOf(['table', 'grid', 'masonry']),
  renderCard: PropTypes.func,
  gridCols: PropTypes.oneOf([2, 3, 4, 5, 6]),
  columnWidth: PropTypes.number,

  // Infinite scroll (masonry)
  onLoadMore: PropTypes.func,
  hasMore: PropTypes.bool,
  loadingMore: PropTypes.bool,

  // Selection
  selectable: PropTypes.bool,
  selectedKeys: PropTypes.array,
  onSelectionChange: PropTypes.func,
  onRowClick: PropTypes.func,
  onRowDoubleClick: PropTypes.func,

  // States
  loading: PropTypes.bool,
  initialized: PropTypes.bool,

  // Table variant
  variant: PropTypes.oneOf(['surface', 'ghost']),
  borderless: PropTypes.bool,
  fillHeight: PropTypes.bool,

  // Compound children
  children: PropTypes.node,
};

// ============================================================================
// Attach sub-components
// ============================================================================

DataTable.Header = DataTableHeader;
DataTable.Toolbar = DataTableToolbar;
DataTable.Search = DataTableSearch;
DataTable.Filter = DataTableFilter;
DataTable.ClearFilters = DataTableClearFilters;
DataTable.ViewToggle = DataTableViewToggle;
DataTable.BulkActions = DataTableBulkActions;
DataTable.Empty = DataTableEmpty;
DataTable.Error = DataTableError;
DataTable.Loader = DataTableLoader;
DataTable.Pagination = DataTablePagination;

export default DataTable;
