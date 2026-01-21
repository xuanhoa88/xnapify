/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useEffect, useCallback } from 'react';
import clsx from 'clsx';
import Icon from '../../../../../../../components/Icon';
import Button from '../../../../../../../components/Button';
import s from './ScrollToTop.css';

/**
 * ScrollToTop Component
 * Floating button that appears when user scrolls down
 */
function ScrollToTop() {
  const [showScroll, setShowScroll] = useState(false);

  useEffect(() => {
    let timeoutId = null;

    const handleScroll = () => {
      // Throttle scroll events for better performance
      if (timeoutId) {
        return;
      }

      timeoutId = setTimeout(() => {
        const scrollTop =
          window.pageYOffset || document.documentElement.scrollTop;
        setShowScroll(scrollTop > 300);
        timeoutId = null;
      }, 100);
    };

    // Use passive listener for better scroll performance
    window.addEventListener('scroll', handleScroll, { passive: true });

    // Check initial scroll position
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  const scrollToTop = useCallback(() => {
    // Check if smooth scroll is supported
    if ('scrollBehavior' in document.documentElement.style) {
      window.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    } else {
      // Fallback for older browsers/mobile devices
      window.scrollTo(0, 0);
    }
  }, []);

  return (
    <Button
      variant='primary'
      iconOnly
      className={clsx(s.scrollToTop, { [s.visible]: showScroll })}
      onClick={scrollToTop}
      title='Scroll to top'
    >
      <Icon name='arrowUp' size={24} className={s.icon} />
    </Button>
  );
}

export default ScrollToTop;
