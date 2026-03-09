/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import PropTypes from 'prop-types';
import clsx from 'clsx';
import s from './Table.css';

function Table({ children, className, containerClassName, ...props }) {
  return (
    <div className={clsx(s.tableContainer, containerClassName)}>
      <table className={clsx(s.table, className)} {...props}>
        {children}
      </table>
    </div>
  );
}

Table.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  containerClassName: PropTypes.string,
};

export default Table;
