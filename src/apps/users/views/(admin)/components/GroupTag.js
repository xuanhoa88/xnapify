/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { Badge } from '@radix-ui/themes';
import PropTypes from 'prop-types';

import s from './GroupTag.css';

export default function GroupTag({ name, className = '' }) {
  return (
    <Badge
      className={`${s.groupTag} ${className}`}
      color='gray'
      radius='full'
      variant='soft'
    >
      {name}
    </Badge>
  );
}

GroupTag.propTypes = {
  name: PropTypes.string.isRequired,
  className: PropTypes.string,
};
