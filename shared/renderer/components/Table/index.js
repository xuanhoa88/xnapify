/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import BulkActionsBar from './BulkActionsBar';
import Empty from './Empty';
import Error from './Error';
import Pagination from './Pagination';
import SearchBar from './SearchBar';
import Table from './Table';

Table.Error = Error;
Table.Empty = Empty;
Table.Pagination = Pagination;
Table.BulkActionsBar = BulkActionsBar;
Table.SearchBar = SearchBar;

export default Table;
