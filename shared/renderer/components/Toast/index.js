/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

import { Flex, Text, Box, IconButton } from '@radix-ui/themes';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import Icon from '../Icon/index.js';

import s from './Index.css';

/** Auto-dismiss delay used when the caller does not specify one. */
const DEFAULT_DURATION = 4000;

/** Must stay in sync with the transition duration in Index.css. */
const EXIT_ANIMATION_MS = 200;

/** Corner a toast appears in when the caller does not choose one. */
const DEFAULT_PLACEMENT = 'bottom-right';

/*
 * One table per variant, keyed by the camelCase name the CSS-modules loader
 * exports. Rspack exports camelCase *only* — `.variant-success` is reachable as
 * `variantSuccess` and by no other key — so a kebab-case lookup here resolves
 * to `undefined`, the class never reaches the element, `--toast-bg` stays
 * undefined and the card paints with no background at all.
 */
const VARIANTS = {
  success: {
    icon: 'CheckCircledIcon',
    color: 'green',
    className: s.variantSuccess,
  },
  error: {
    icon: 'CrossCircledIcon',
    color: 'red',
    className: s.variantError,
  },
  warning: {
    icon: 'ExclamationTriangleIcon',
    color: 'amber',
    className: s.variantWarning,
  },
  info: {
    icon: 'InfoCircledIcon',
    color: 'blue',
    className: s.variantInfo,
  },
};

// Placement styles mapping
const PLACEMENTS = {
  'top-right': s.placementTopRight,
  'top-left': s.placementTopLeft,
  'top-center': s.placementTopCenter,
  'bottom-right': s.placementBottomRight,
  'bottom-left': s.placementBottomLeft,
  'bottom-center': s.placementBottomCenter,
};

const getPlacementClass = placement =>
  PLACEMENTS[placement] || PLACEMENTS[DEFAULT_PLACEMENT];

/*
 * Errors and warnings interrupt the screen reader; success/info wait for a gap.
 * Which of the two live regions the card is rendered into follows from this —
 * the politeness of a region is never changed after it is mounted, because a
 * region re-registered in the same commit that inserts its content is exactly
 * as unreliable as one that appears with its content.
 */
const isUrgent = variant => variant === 'error' || variant === 'warning';

const Toast = forwardRef(function Toast(
  { closable = true, className = '', placement = DEFAULT_PLACEMENT },
  ref,
) {
  const { t } = useTranslation();

  // 'hidden' → 'entering' → 'entered' → 'exiting' → 'hidden'
  const [phase, setPhase] = useState('hidden');
  const [config, setConfig] = useState({
    variant: 'info',
    title: '',
    message: '',
  });

  // Auto-dismiss timer and exit-animation timer are tracked separately: a new
  // message must be able to cancel *both*, otherwise the previous toast's exit
  // timer fires later and tears down the message that replaced it.
  const dismissTimerRef = useRef(null);
  const exitTimerRef = useRef(null);

  // Whether a card is on screen (including one playing its exit animation).
  // `phase` cannot answer that synchronously — it is only current after the
  // commit — and `hide()` has to know before it schedules anything.
  const visibleRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
  }, []);

  const hide = useCallback(() => {
    clearTimers();

    // Hiding what is already hidden must not schedule an exit animation for a
    // card that is not there: the timer would sit pending for 200ms doing
    // nothing, and would still be pending if the component unmounted first.
    if (!visibleRef.current) return;

    setPhase('exiting');
    exitTimerRef.current = setTimeout(() => {
      exitTimerRef.current = null;
      visibleRef.current = false;
      setPhase('hidden');
    }, EXIT_ANIMATION_MS);
  }, [clearTimers]);

  const show = useCallback(
    (options = {}) => {
      clearTimers();

      // `duration: 0` means "stay until dismissed" — don't collapse it to the
      // default the way `||` would.
      const duration = Number.isFinite(options.duration)
        ? options.duration
        : DEFAULT_DURATION;

      setConfig({
        variant: options.variant || 'info',
        title: options.title || '',
        message: options.message || '',
      });

      // Replay the enter transition only when coming from a non-visible state;
      // replacing the text of a toast that is already on screen should not
      // make it flash.
      visibleRef.current = true;
      setPhase(prev => (prev === 'entered' ? 'entered' : 'entering'));

      if (duration > 0) {
        dismissTimerRef.current = setTimeout(() => {
          dismissTimerRef.current = null;
          hide();
        }, duration);
      }
    },
    [clearTimers, hide],
  );

  // Commit the entered state on the next frame so the CSS transition has a
  // "from" frame to animate out of.
  useEffect(() => {
    if (phase !== 'entering') return undefined;
    const frame = requestAnimationFrame(() => setPhase('entered'));
    return () => cancelAnimationFrame(frame);
  }, [phase]);

  // Never leave a timer running past unmount.
  useEffect(() => clearTimers, [clearTimers]);

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

  const { variant, title, message } = config;
  const isVisible = phase !== 'hidden';
  const {
    icon,
    color,
    className: variantClass,
  } = VARIANTS[variant] || VARIANTS.info;

  const transitionClass =
    phase === 'entered'
      ? s.visible
      : placement.includes('top')
        ? s.hiddenTop
        : s.hiddenBottom;

  const regionClass = clsx(s.liveRegion, getPlacementClass(placement));

  const card = isVisible ? (
    <Box
      className={clsx(s.toastCard, variantClass, transitionClass, className)}
    >
      <Flex p='3' gap='3' align='start'>
        <Box className={s.iconBox}>
          <Icon name={icon} size={20} />
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
            aria-label={t(
              'common:components.toast.close',
              'Close notification',
            )}
            className={s.closeButton}
          >
            <Icon name='Cross2Icon' size={16} />
          </IconButton>
        )}
      </Flex>
    </Box>
  ) : null;

  // Both live regions are mounted at all times, each with the politeness it
  // will keep for the life of the component; the card is rendered into the one
  // that matches its variant. Screen readers only announce content inserted
  // into a region that already exists *and* whose politeness they have already
  // registered — a region that appears together with its message, or changes
  // politeness in the same commit, is announced by almost nothing. Whichever
  // region is empty is a 0x0 box that neither paints nor takes clicks.
  const urgent = isUrgent(variant);
  return (
    <>
      <Box
        className={regionClass}
        role='status'
        aria-live='polite'
        aria-atomic='true'
      >
        {urgent ? null : card}
      </Box>
      <Box
        className={regionClass}
        role='alert'
        aria-live='assertive'
        aria-atomic='true'
      >
        {urgent ? card : null}
      </Box>
    </>
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
