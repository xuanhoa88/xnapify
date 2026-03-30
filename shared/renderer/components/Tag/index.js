/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import s from './Tag.css';

/**
 * Get variant class name
 */
const getVariantClass = variant => {
  const variantClasses = {
    primary: s.variantPrimary,
    secondary: s.variantSecondary,
    success: s.variantSuccess,
    warning: s.variantWarning,
    error: s.variantError,
    info: s.variantInfo,
    neutral: s.variantNeutral,
  };
  return variantClasses[variant] || s.variantNeutral;
};

/**
 * Tag component - displays a styled badge/tag
 */
function Tag({ children, variant = 'neutral', className = '', ...props }) {
  const isInteractive = !!props.onClick;
  const classes = [
    s.tag,
    getVariantClass(variant),
    isInteractive && s.interactive,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={classes} {...props}>
      {children}
    </span>
  );
}

Tag.propTypes = {
  children: PropTypes.node.isRequired,
  variant: PropTypes.oneOf([
    'primary',
    'secondary',
    'success',
    'warning',
    'error',
    'info',
    'neutral',
  ]),
  className: PropTypes.string,
  onClick: PropTypes.func,
};

/**
 * TagList component - displays a list of tags with empty state
 */
function TagList({ children, emptyText, className = '' }) {
  const { t } = useTranslation();
  const displayEmptyText =
    emptyText || t('shared:components.tagList.empty', '—');

  const hasChildren = Array.isArray(children)
    ? children.filter(Boolean).length > 0
    : Boolean(children);

  if (!hasChildren) {
    return <span className={s.empty}>{displayEmptyText}</span>;
  }

  const classes = [s.tagList, className].filter(Boolean).join(' ');
  return <div className={classes}>{children}</div>;
}

TagList.propTypes = {
  children: PropTypes.node,
  emptyText: PropTypes.string,
  className: PropTypes.string,
};

// Attach sub-components
Tag.List = TagList;

export default Tag;
