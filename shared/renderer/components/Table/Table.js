/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useMemo } from 'react';

import clsx from 'clsx';
import PropTypes from 'prop-types';

import Loader from '../Loader';

import Empty from './Empty';
import Pagination from './Pagination';
import s from './Table.css';

function Table({
  columns,
  dataSource,
  rowKey = 'id',
  rowClassName,
  loading = false,
  pagination = false,
  rowSelection = null,
  locale = {},
  children,
  className,
  containerClassName,
  ...props
}) {
  const getRowKey = (record, index) => {
    if (typeof rowKey === 'function') {
      return rowKey(record, index);
    }
    return record[rowKey] || index;
  };

  const handleSelectAll = e => {
    if (!rowSelection) return;
    if (e.target.checked) {
      const allKeys = (dataSource || []).map(getRowKey);
      rowSelection.onChange(allKeys, dataSource);
    } else {
      rowSelection.onChange([], []);
    }
  };

  const handleSelectRow = (record, index, checked) => {
    if (!rowSelection) return;
    const key = getRowKey(record, index);
    let newKeys;
    if (checked) {
      newKeys = [...(rowSelection.selectedRowKeys || []), key];
    } else {
      newKeys = (rowSelection.selectedRowKeys || []).filter(k => k !== key);
    }
    const newSelectedRows = (dataSource || []).filter((r, i) =>
      newKeys.includes(getRowKey(r, i)),
    );
    rowSelection.onChange(newKeys, newSelectedRows);
  };

  const isAllSelected = useMemo(() => {
    if (!rowSelection || !dataSource || !dataSource.length) return false;
    const allKeys = dataSource.map(getRowKey);
    return allKeys.every(k => (rowSelection.selectedRowKeys || []).includes(k));
  }, [dataSource, rowSelection, rowKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // If columns and dataSource are provided, render Antd style
  if (columns) {
    const defaultPagination = {
      current: 1,
      pageSize: 20,
      total: 0,
      onChange: () => {},
    };
    const pOptions = pagination
      ? { ...defaultPagination, ...pagination }
      : null;

    const totalPages = pOptions
      ? pOptions.pages || Math.ceil(pOptions.total / pOptions.pageSize)
      : 0;

    return (
      <div className={clsx(s.tableWrapper, containerClassName)}>
        <div className={s.tableContainer}>
          <table className={clsx(s.table, className)} {...props}>
            <thead>
              <tr>
                {rowSelection && (
                  <th className={s.checkboxCol}>
                    <input
                      type='checkbox'
                      className={s.checkbox}
                      checked={isAllSelected}
                      onChange={handleSelectAll}
                    />
                  </th>
                )}
                {columns.map((col, idx) => (
                  <th
                    key={col.key || col.dataIndex || idx}
                    className={col.className}
                    style={{ width: col.width, textAlign: col.align || 'left' }}
                  >
                    {col.title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (!dataSource || dataSource.length === 0) ? (
                <tr>
                  <td
                    colSpan={columns.length + (rowSelection ? 1 : 0)}
                    className={s.loadingCell}
                  >
                    <Loader variant='spinner' />
                  </td>
                </tr>
              ) : !dataSource || dataSource.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + (rowSelection ? 1 : 0)}
                    className={s.emptyCell}
                  >
                    {locale.emptyText || <Empty />}
                  </td>
                </tr>
              ) : (
                dataSource.map((record, index) => {
                  const key = getRowKey(record, index);
                  const isSelected =
                    rowSelection &&
                    rowSelection.selectedRowKeys &&
                    rowSelection.selectedRowKeys.includes(key);
                  const customRowClass =
                    typeof rowClassName === 'function'
                      ? rowClassName(record, index)
                      : rowClassName;

                  return (
                    <tr
                      key={key}
                      className={clsx(customRowClass, {
                        [s.selectedRow]: isSelected,
                      })}
                    >
                      {rowSelection && (
                        <td className={s.checkboxCol}>
                          <input
                            type='checkbox'
                            className={s.checkbox}
                            checked={isSelected}
                            onChange={e =>
                              handleSelectRow(record, index, e.target.checked)
                            }
                          />
                        </td>
                      )}
                      {columns.map((col, idx) => (
                        <td
                          key={col.key || col.dataIndex || idx}
                          className={col.className}
                          style={{ textAlign: col.align || 'left' }}
                        >
                          {col.render
                            ? col.render(
                                col.dataIndex ? record[col.dataIndex] : record,
                                record,
                                index,
                              )
                            : record[col.dataIndex]}
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          {loading && dataSource && dataSource.length > 0 && (
            <div className={s.loadingOverlay}>
              <Loader variant='spinner' />
            </div>
          )}
        </div>
        {pagination && pOptions && (totalPages > 1 || pOptions.total > 0) && (
          <div className={s.paginationWrapper}>
            <Pagination
              currentPage={pOptions.current}
              totalPages={totalPages}
              totalItems={pOptions.total}
              onPageChange={pOptions.onChange}
              loading={loading}
            />
          </div>
        )}
      </div>
    );
  }

  // Fallback to legacy children behavior
  return (
    <div className={clsx(s.tableContainer, containerClassName)}>
      <table className={clsx(s.table, className)} {...props}>
        {children}
      </table>
    </div>
  );
}

Table.propTypes = {
  columns: PropTypes.array,
  dataSource: PropTypes.array,
  rowKey: PropTypes.oneOfType([PropTypes.string, PropTypes.func]),
  rowClassName: PropTypes.oneOfType([PropTypes.string, PropTypes.func]),
  loading: PropTypes.bool,
  pagination: PropTypes.oneOfType([PropTypes.bool, PropTypes.object]),
  rowSelection: PropTypes.object,
  locale: PropTypes.object,
  children: PropTypes.node,
  className: PropTypes.string,
  containerClassName: PropTypes.string,
};

export default Table;
