/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
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

import clsx from 'clsx';
import PropTypes from 'prop-types';

import Button from '../Button';
import Icon from '../Icon';

// eslint-disable-next-line css-modules/no-unused-class -- classes accessed dynamically via s[variant] and s[placementClasses[placement]]
import s from './Toast.css';

/**
 * Toast - Notification component controlled via ref
 *
 * Usage:
 *   const toastRef = useRef();
 *
 *   // Show toast imperatively
 *   toastRef.current.show({
 *     variant: 'success',
 *     message: 'Operation successful!',
 *     title: 'Success', // optional
 *     duration: 4000,   // optional, default 4000ms
 *   });
 *
 *   // Hide toast imperatively
 *   toastRef.current.hide();
 *
 *   <Toast ref={toastRef} placement="top-center" />
 */

// Icon mapping for each variant
const variantIcons = {
  success: 'check-circle',
  error: 'x-circle',
  warning: 'alert-triangle',
  info: 'info',
};

// CSS class mapping for each placement
const placementClasses = {
  'top-right': 'topRight',
  'top-left': 'topLeft',
  'top-center': 'topCenter',
  'bottom-right': 'bottomRight',
  'bottom-left': 'bottomLeft',
  'bottom-center': 'bottomCenter',
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
  const placementClass = placementClasses[placement] || 'topCenter';

  return (
    <div
      className={clsx(
        s.toast,
        s[variant],
        s[placementClass],
        { [s.exiting]: isExiting },
        className,
      )}
      role='alert'
      aria-live='polite'
    >
      <div className={s.iconWrapper}>
        <Icon name={iconName} size={20} className={s.icon} />
      </div>
      <div className={s.content}>
        {title && <div className={s.title}>{title}</div>}
        <div className={s.message}>{message}</div>
      </div>
      {closable && (
        <Button
          variant='ghost'
          iconOnly
          className={s.closeButton}
          onClick={hide}
          aria-label='Close notification'
        >
          <Icon name='close' size={16} />
        </Button>
      )}
    </div>
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
