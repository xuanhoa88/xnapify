/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import PropTypes from 'prop-types';
import clsx from 'clsx';
import s from './Header.css';

/**
 * Header Component
 *
 * A reusable page header with icon, title, subtitle, and actions
 */
function Header({ icon, title, subtitle, children, className, breadcrumb }) {
  return (
    <header className={clsx(s.header, className)}>
      <div className={s.headerContent}>
        {/* Icon */}
        {icon && <span className={s.icon}>{icon}</span>}

        {/* Title Section */}
        <div className={s.titleSection}>
          {breadcrumb && <span className={s.breadcrumb}>{breadcrumb}</span>}
          <h1 className={s.title}>{title}</h1>
          {subtitle && <p className={s.subtitle}>{subtitle}</p>}
        </div>
      </div>

      {/* Actions */}
      {children && <div className={s.actions}>{children}</div>}
    </header>
  );
}

Header.propTypes = {
  icon: PropTypes.node,
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  children: PropTypes.node,
  className: PropTypes.string,
  breadcrumb: PropTypes.string,
};

export default Header;
