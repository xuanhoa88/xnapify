/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import PropTypes from 'prop-types';
import Tag from '@shared/renderer/components/Tag';
import s from './GroupTag.css';

/**
 * GroupTag component - specialized tag for displaying groups
 */
function GroupTag({ name, className = '' }) {
  const classes = [s.groupTag, className].filter(Boolean).join(' ');

  return <Tag className={classes}>{name}</Tag>;
}

GroupTag.propTypes = {
  name: PropTypes.string.isRequired,
  className: PropTypes.string,
};

export default GroupTag;
