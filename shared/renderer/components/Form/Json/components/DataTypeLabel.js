/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { Text } from '@radix-ui/themes';
import PropTypes from 'prop-types';

import s from './DataTypeLabel.css';

export function DataTypeLabel({ type, show }) {
  if (!show) return null;
  return (
    <Text as='span' className={s.dataTypeLabel}>
      {type}
    </Text>
  );
}

DataTypeLabel.propTypes = {
  type: PropTypes.string.isRequired,
  show: PropTypes.bool.isRequired,
};

export function getInitialType(val) {
  if (val === null) return 'null';
  if (Array.isArray(val)) return 'array';
  if (typeof val === 'object') return 'object';
  if (typeof val === 'boolean') return 'boolean';
  if (typeof val === 'number') return 'number';
  return 'string';
}
