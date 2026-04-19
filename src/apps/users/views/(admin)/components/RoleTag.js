/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import * as RadixIcons from '@radix-ui/react-icons';
import { Badge } from '@radix-ui/themes';
import PropTypes from 'prop-types';

import s from './RoleTag.css';

export default function RoleTag({ name, className = '' }) {
  const roleLower = typeof name === 'string' ? name.toLowerCase() : '';
  const displayName = typeof name === 'string' ? name : String(name);

  if (!roleLower) return null;

  // Determine tag variant based on role name
  let variant = 'neutral';
  let icon = null;

  if (roleLower.includes('admin')) {
    variant = 'primary';
    icon = RadixIcons.LockClosedIcon;
  } else if (roleLower.includes('mod')) {
    variant = 'warning';
    icon = RadixIcons.StarIcon;
  } else if (roleLower.includes('editor')) {
    variant = 'secondary';
  }

  return (
    <Badge
      color={
        variant === 'neutral'
          ? 'gray'
          : variant === 'primary'
            ? 'indigo'
            : variant === 'warning'
              ? 'yellow'
              : variant === 'secondary'
                ? 'gray'
                : 'gray'
      }
      variant={
        variant === 'neutral' || variant === 'secondary' ? 'surface' : 'soft'
      }
      className={className}
      radius='full'
    >
      {icon &&
        (() => {
          const Comp = icon;
          return <Comp width={12} height={12} className={s.roleIconFlex} />;
        })()}
      {displayName}
    </Badge>
  );
}

RoleTag.propTypes = {
  name: PropTypes.string,
  className: PropTypes.string,
};
