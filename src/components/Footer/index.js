/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useEffect } from 'react';
import clsx from 'clsx';
import { Link } from '../../components/History';
import s from './Footer.css';
import { useTranslation } from 'react-i18next';

function Footer() {
  const { t } = useTranslation();
  const [showScroll, setShowScroll] = useState(false);
  const currentYear = new Date().getFullYear();

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

  const scrollToTop = () => {
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
  };

  return (
    <>
      <div className={s.root}>
        <div className={s.container}>
          <span className={s.text}>
            {t('footer.copyright', { year: currentYear })}
          </span>
          <span className={s.spacer}>·</span>
          <Link className={s.link} to='/'>
            {t('navigation.home')}
          </Link>
          <span className={s.spacer}>·</span>
          <Link className={s.link} to='/admin'>
            {t('navigation.admin')}
          </Link>
          <span className={s.spacer}>·</span>
          <Link className={s.link} to='/privacy'>
            {t('navigation.privacy')}
          </Link>
          <span className={s.spacer}>·</span>
          <Link className={s.link} to='/not-found'>
            {t('navigation.notFound')}
          </Link>
        </div>
      </div>

      {/* Scroll to Top Button */}
      <button
        className={clsx(s.scrollToTop, showScroll ? s.visible : '')}
        onClick={scrollToTop}
        aria-label='Scroll to top'
        type='button'
      >
        <svg
          className={s.icon}
          viewBox='0 0 24 24'
          xmlns='http://www.w3.org/2000/svg'
        >
          <path d='M12 19V5M5 12l7-7 7 7' />
        </svg>
      </button>
    </>
  );
}

export default Footer;
