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
        className='border-t border-gray-a6 bg-transparent'
      >
        <footer>
          <Text size='3' color='gray'>
            {t('footer.copyright', { year: currentYear })}
          </Text>
        </footer>
      </Flex>

      {/* Scroll to Top Button */}
      <Button
        variant='solid'
        color='indigo'
        onClick={scrollToTop}
        title={t('common.scrollToTop', 'Scroll to top')}
        className={clsx(
          'fixed bottom-6 right-6 w-10 h-10 rounded-xl shadow-md z-50 transition-all duration-300 flex items-center justify-center cursor-pointer',
          showScroll
            ? 'opacity-100 visible translate-y-0'
            : 'opacity-0 invisible translate-y-2',
        )}
      >
        <ArrowUpIcon width={20} height={20} />
      </Button>
    </>
  );
}

export default AdminFooter;
