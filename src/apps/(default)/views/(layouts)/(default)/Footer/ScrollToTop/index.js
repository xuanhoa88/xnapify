/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useEffect, useCallback } from 'react';

import { ArrowUpIcon } from '@radix-ui/react-icons';
import { Button } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';

import s from './ScrollToTop.css';

/**
 * ScrollToTop Component
 * Floating button that appears when user scrolls down built with inline Radix tokens
 */
function ScrollToTop() {
  const { t } = useTranslation();
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
      variant='solid'
      color='indigo'
      onClick={scrollToTop}
      title={t('common.scrollToTop', 'Scroll to top')}
      className={s.scrollBtnDefault}
      // eslint-disable-next-line react/forbid-dom-props
      style={{
        opacity: showScroll ? 1 : 0,
        visibility: showScroll ? 'visible' : 'hidden',
        transform: showScroll ? 'translateY(0)' : 'translateY(20px)',
      }}
    >
      <ArrowUpIcon width={24} height={24} />
    </Button>
  );
}

export default ScrollToTop;
