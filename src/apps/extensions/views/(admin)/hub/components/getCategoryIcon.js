/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import * as RadixIcons from '@radix-ui/react-icons';

const ICON_MAP = {
  utility: RadixIcons.GearIcon,
  integration: RadixIcons.Link2Icon,
  cms: RadixIcons.Pencil1Icon,
  payment: RadixIcons.CardStackIcon, // better than file-text
  social: RadixIcons.PersonIcon, // better than users
  security: RadixIcons.LockClosedIcon,
  analytics: RadixIcons.ActivityLogIcon,
  storage: RadixIcons.BoxIcon,
  auth: RadixIcons.LockClosedIcon,
  authentication: RadixIcons.LockClosedIcon,
  communication: RadixIcons.EnvelopeClosedIcon,
  productivity: RadixIcons.CheckCircledIcon,
  'developer tools': RadixIcons.CodeIcon,
};

export default function getCategoryIcon(category) {
  return ICON_MAP[category ? category.toLowerCase() : ''] || RadixIcons.BoxIcon;
}
