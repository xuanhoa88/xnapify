/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

import { Flex, Text, Box, IconButton } from '@radix-ui/themes';
import PropTypes from 'prop-types';

import Icon from '../Icon';

import s from './Index.css';

// Icon mapping for each variant
const variantIcons = {
  success: 'check-circle',
  error: 'x-circle',
  warning: 'alert-triangle',
  info: 'info',
};

// Placement styles mapping
const getPlacementClass = placement => {
  switch (placement) {
    case 'top-right':
      return s['placement-top-right'];
    case 'top-left':
      return s['placement-top-left'];
    case 'top-center':
      return s['placement-top-center'];
    case 'bottom-right':
      return s['placement-bottom-right'];
    case 'bottom-left':
      return s['placement-bottom-left'];
    case 'bottom-center':
      return s['placement-bottom-center'];
    default:
      return s['placement-top-center'];
  }
};

const getVariantColor = variant => {
  switch (variant) {
    case 'success':
      return 'green';
    case 'error':
      return 'red';
    case 'warning':
      return 'amber';
    case 'info':
      return 'blue';
    default:
      return 'gray';
  }
};

const Toast = forwardRef(function Toast(
  { closable = true, className = '', placement = 'top-center' },
  ref,
) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [config, setConfig] = useState({
    variant: 'info',
    title: '',
    message: '',
    duration: 4000,
  });

  const timerRef = useRef(null);

  const hide = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsExiting(true);
    // Wait for exit animation to complete
    setTimeout(() => {
      setIsVisible(false);
      setIsExiting(false);
    }, 200);
  }, []);

  const show = useCallback(
    (options = {}) => {
      // Clear any existing timer
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      const newConfig = {
        variant: options.variant || 'info',
        title: options.title || '',
        message: options.message || '',
        duration: options.duration || 4000,
      };

      setConfig(newConfig);
      setIsExiting(false);
      setIsVisible(true);

      // Set auto-dismiss timer
      if (newConfig.duration > 0) {
        timerRef.current = setTimeout(() => {
          hide();
        }, newConfig.duration);
      }
    },
    [hide],
  );

  // Alias methods for each variant
  const success = useCallback(
    (message, options = {}) =>
      show({ ...options, variant: 'success', message }),
    [show],
  );

  const error = useCallback(
    (message, options = {}) => show({ ...options, variant: 'error', message }),
    [show],
  );

  const warning = useCallback(
    (message, options = {}) =>
      show({ ...options, variant: 'warning', message }),
    [show],
  );

  const info = useCallback(
    (message, options = {}) => show({ ...options, variant: 'info', message }),
    [show],
  );

  // Expose methods via ref
  useImperativeHandle(
    ref,
    () => ({
      show,
      hide,
      success,
      error,
      warning,
      info,
    }),
    [show, hide, success, error, warning, info],
  );

  if (!isVisible) {
    return null;
  }

  const { variant, title, message } = config;
  const iconName = variantIcons[variant];
  const color = getVariantColor(variant);

  const placementClass = getPlacementClass(placement);
  const variantClass = s[`variant-${variant}`] || s['variant-info'];

  // Transition logic
  const isTop = placement.includes('top');
  const isCenter = placement.includes('center');

  let transitionClass;
  if (isExiting) {
    if (isTop && isCenter) transitionClass = s.exitingTopCenter;
    else if (!isTop && isCenter) transitionClass = s.exitingBottomCenter;
    else if (isTop) transitionClass = s.exitingTop;
    else transitionClass = s.exitingBottom;
  } else {
    if (isTop && isCenter) transitionClass = s.enteredTopCenter;
    else if (!isTop && isCenter) transitionClass = s.enteredBottomCenter;
    else if (isTop) transitionClass = s.enteredTop;
    else transitionClass = s.enteredBottom;
  }

  const containerClasses = [
    s.toastContainer,
    placementClass,
    variantClass,
    transitionClass,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Box className={containerClasses} role='alert' aria-live='polite'>
      <Flex p='3' gap='3' align='start'>
        <Box className={s.iconBox}>
          <Icon name={iconName} size={20} />
        </Box>
        <Flex direction='column' gap='1' className={s.contentFlex}>
          {title && (
            <Text size='2' weight='bold' className={s.titleText}>
              {title}
            </Text>
          )}
          <Text size='2' className={s.messageText}>
            {message}
          </Text>
        </Flex>
        {closable && (
          <IconButton
            variant='ghost'
            color={color}
            size='1'
            onClick={hide}
            aria-label='Close notification'
            className={s.closeButton}
          >
            <Icon name='close' size={16} />
          </IconButton>
        )}
      </Flex>
    </Box>
  );
});

Toast.displayName = 'Toast';

Toast.propTypes = {
  /** Whether the toast can be dismissed manually */
  closable: PropTypes.bool,
  /** Additional CSS class names */
  className: PropTypes.string,
  /** Placement of the toast: 'top-right', 'top-left', 'top-center', 'bottom-right', 'bottom-left', 'bottom-center' */
  placement: PropTypes.oneOf([
    'top-right',
    'top-left',
    'top-center',
    'bottom-right',
    'bottom-left',
    'bottom-center',
  ]),
};

export default Toast;
