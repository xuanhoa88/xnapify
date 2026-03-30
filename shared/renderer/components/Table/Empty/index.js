/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import clsx from 'clsx';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import Icon from '../../Icon';

import s from './Empty.css';

/**
 * Empty Component
 *
 * A professional empty state component for admin pages.
 * Displays an icon, message, description, and optional action button.
 */
function Empty({ icon = 'inbox', title, description, children, className }) {
  const { t } = useTranslation();

  const displayTitle =
    title || t('shared:components.table.empty.title', 'No items found');

  return (
    <div className={clsx(s.root, className)}>
      <div className={s.iconWrapper}>
        <Icon name={icon} size={48} />
      </div>
      <h3 className={s.title}>{displayTitle}</h3>
      {description && <p className={s.description}>{description}</p>}
      {children}
    </div>
  );
}

Empty.propTypes = {
  /** Icon name to display */
  icon: PropTypes.string,
  /** Main title/message */
  title: PropTypes.string,
  /** Optional description text */
  description: PropTypes.string,
  /** Optional content to render (usually an action button) */
  children: PropTypes.node,
  /** Additional CSS classes */
  className: PropTypes.string,
};

export default Empty;
