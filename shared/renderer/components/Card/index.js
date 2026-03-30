/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import clsx from 'clsx';
import PropTypes from 'prop-types';

// eslint-disable-next-line css-modules/no-unused-class -- classes accessed dynamically via props
import s from './Card.css';

/**
 * Card - Reusable card component with composable sub-components
 *
 * Usage:
 *   <Card variant="elevated">
 *     <Card.Header>Card Title</Card.Header>
 *     <Card.Body>
 *       <p>Card content here</p>
 *     </Card.Body>
 *     <Card.Footer>
 *       <Button>Action</Button>
 *     </Card.Footer>
 *   </Card>
 */

/**
 * Card.Header - Card header with content and optional actions
 */
const CardHeader = ({ children, actions, className = '' }) => (
  <div className={clsx(s.cardHeader, className)}>
    <div className={s.cardHeaderContent}>{children}</div>
    {actions && <div className={s.cardHeaderActions}>{actions}</div>}
  </div>
);

CardHeader.propTypes = {
  children: PropTypes.node.isRequired,
  actions: PropTypes.node,
  className: PropTypes.string,
};

/**
 * Card.Body - Card body container
 */
const CardBody = ({ children, className = '' }) => (
  <div className={clsx(s.cardBody, className)}>{children}</div>
);

CardBody.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
};

/**
 * Card.Footer - Card footer container
 */
const CardFooter = ({ children, align = 'right', className = '' }) => {
  const alignClass = {
    left: s.cardFooterLeft,
    center: s.cardFooterCenter,
    right: '',
    'space-between': s.cardFooterSpaceBetween,
  }[align];

  return (
    <div className={clsx(s.cardFooter, alignClass, className)}>{children}</div>
  );
};

CardFooter.propTypes = {
  children: PropTypes.node.isRequired,
  align: PropTypes.oneOf(['left', 'center', 'right', 'space-between']),
  className: PropTypes.string,
};

/**
 * Card.Image - Card image component
 */
const CardImage = ({
  src,
  alt,
  position = 'top',
  height,
  className = '',
  ...props
}) => {
  const positionClass = position === 'top' ? s.cardImageTop : s.cardImageBottom;

  return (
    <img
      src={src}
      alt={alt}
      className={clsx(s.cardImage, positionClass, className)}
      style={height ? { height, objectFit: 'cover' } : undefined}
      {...props}
    />
  );
};

CardImage.propTypes = {
  src: PropTypes.string.isRequired,
  alt: PropTypes.string.isRequired,
  position: PropTypes.oneOf(['top', 'bottom']),
  height: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  className: PropTypes.string,
};

/**
 * Card - Main card wrapper
 */
function Card({
  children,
  variant = 'default',
  padding = 'medium',
  interactive = false,
  selected = false,
  className = '',
  as: Component = 'div',
  ...props
}) {
  const paddingClass = {
    none: s.paddingNone,
    small: s.paddingSmall,
    medium: s.paddingMedium,
    large: s.paddingLarge,
  }[padding];

  return (
    <Component
      className={clsx(
        s.card,
        s[variant],
        paddingClass,
        { [s.interactive]: interactive },
        { [s.selected]: selected },
        className,
      )}
      {...props}
    >
      {children}
    </Component>
  );
}

Card.propTypes = {
  /** Card content */
  children: PropTypes.node.isRequired,
  /** Visual style variant */
  variant: PropTypes.oneOf([
    'default',
    'elevated',
    'outlined',
    'ghost',
    'gradient',
  ]),
  /** Padding size */
  padding: PropTypes.oneOf(['none', 'small', 'medium', 'large']),
  /** Interactive (clickable) card */
  interactive: PropTypes.bool,
  /** Selected state */
  selected: PropTypes.bool,
  /** Additional CSS class names */
  className: PropTypes.string,
  /** Element type to render as */
  as: PropTypes.elementType,
};

// Attach sub-components
Card.Header = CardHeader;
Card.Body = CardBody;
Card.Footer = CardFooter;
Card.Image = CardImage;

export default Card;
