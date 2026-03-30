/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useEffect, useCallback } from 'react';

import clsx from 'clsx';
import { useTranslation } from 'react-i18next';

import Button from '@shared/renderer/components/Button';
import Icon from '@shared/renderer/components/Icon';

import s from './Footer.css';

/**
 * AdminFooter Component
 *
 * A minimal, professional footer for admin panel pages.
 * Features: Copyright info and scroll-to-top button.
 */
function AdminFooter() {
  const { t } = useTranslation();
  const [showScroll, setShowScroll] = useState(false);
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    let timeoutId = null;

    const handleScroll = () => {
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

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  const scrollToTop = useCallback(() => {
    if ('scrollBehavior' in document.documentElement.style) {
      window.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    } else {
      window.scrollTo(0, 0);
    }
  }, []);

  return (
    <>
      <footer className={s.adminFooter}>
        <div className={s.footerContainer}>
          <span className={s.copyright}>
            {t('footer.copyright', { year: currentYear })}
          </span>
        </div>
      </footer>

      {/* Scroll to Top Button */}
      <Button
        variant='primary'
        iconOnly
        className={clsx(s.scrollToTop, showScroll && s.visible)}
        onClick={scrollToTop}
        title={t('common.scrollToTop', 'Scroll to top')}
      >
        <Icon name='arrowUp' size={20} />
      </Button>
    </>
  );
}

export default AdminFooter;
