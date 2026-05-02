/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useEffect, useCallback } from 'react';

import { ArrowUpIcon } from '@radix-ui/react-icons';
import { Flex, Text, Button } from '@radix-ui/themes';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';

/**
 * AdminFooter Component
 *
 * A minimal, professional footer for admin panel pages built natively with Radix Themes.
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
      <Flex
        asChild
        align='center'
        justify='center'
        p='4'
        px='6'
        className='border-t border-gray-200 bg-transparent'
      >
        <footer>
          <Text size='2' className='text-gray-400'>
            {t('footer.copyright', { year: currentYear })}
          </Text>
        </footer>
      </Flex>

      {/* Scroll to Top Button */}
      <Button
        variant='solid'
        className={clsx(
          'fixed bottom-6 right-6 w-10 h-10 rounded-xl shadow-lg z-50 transition-all duration-300 flex items-center justify-center cursor-pointer bg-[#0e1b38] text-white hover:bg-[#1a294b]',
          showScroll
            ? 'opacity-100 visible translate-y-0'
            : 'opacity-0 invisible translate-y-2',
        )}
        onClick={scrollToTop}
        title={t('common.scrollToTop', 'Scroll to top')}
      >
        <ArrowUpIcon width={20} height={20} />
      </Button>
    </>
  );
}

export default AdminFooter;
