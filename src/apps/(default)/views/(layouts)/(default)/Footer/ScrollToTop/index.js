/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useEffect, useCallback } from 'react';

import { ArrowUpIcon } from '@radix-ui/react-icons';
import { Button } from '@radix-ui/themes';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';

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
      className={clsx(
        'fixed bottom-[var(--space-6)] right-[var(--space-6)] z-50 rounded-full w-12 h-12 p-0 flex items-center justify-center transition-all duration-300 ease-in-out shadow-[var(--shadow-4)] cursor-pointer',
        showScroll
          ? 'opacity-100 translate-y-0 pointer-events-auto'
          : 'opacity-0 translate-y-4 pointer-events-none',
      )}
    >
      <ArrowUpIcon width={24} height={24} />
    </Button>
  );
}

export default ScrollToTop;
