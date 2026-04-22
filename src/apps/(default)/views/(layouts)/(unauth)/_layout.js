/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useEffect, useRef } from 'react';

import { Flex } from '@radix-ui/themes';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import { Link } from '@shared/renderer/components/History';
import Toast from '@shared/renderer/components/Toast';
import { getFlashMessage, clearFlashMessage } from '@shared/renderer/redux';

import s from './_layout.css';

/**
 * Hero Section - Left side branding panel with gradient background
 */
function HeroSection() {
  const { t } = useTranslation();

  return (
    <div
      className={clsx(
        s.hero,
        'hidden md:flex items-center justify-center p-12 relative w-full h-full',
      )}
    >
      <div className='text-center relative z-10'>
        <Link
          to='/'
          className='inline-flex items-center gap-3 no-underline mb-8 hover:-translate-y-0.5 transition-transform'
        >
          <img
            src='/xnapify_38x38.png'
            srcSet='/xnapify_72x72.png 2x'
            width='48'
            height='48'
            alt='xnapify'
            className='rounded-lg'
          />
          <span className='text-xl font-bold text-white'>xnapify</span>
        </Link>
        <h1 className='text-4xl font-bold text-white mb-4 tracking-tight'>
          {t('unauth.heroTitle', 'Welcome to xnapify')}
        </h1>
        <p className='text-lg text-white/85 leading-relaxed max-w-[400px]'>
          {t(
            'unauth.heroSubtitle',
            'The enterprise platform for modern teams.',
          )}
        </p>
      </div>
    </div>
  );
}

/**
 * Unauthenticated Layout
 *
 * Provides a professional split-pane design used across all authentication
 * routes (login, register, email-verification, reset-password).
 */
function UnauthLayout({ children }) {
  const dispatch = useDispatch();
  const flashMessage = useSelector(getFlashMessage);
  const toastRef = useRef(null);

  useEffect(() => {
    if (flashMessage && toastRef.current) {
      toastRef.current.show({
        variant: flashMessage.variant || 'info',
        message: flashMessage.message,
        title: flashMessage.title,
        duration: flashMessage.duration || 4000,
      });
      dispatch(clearFlashMessage());
    }
  }, [flashMessage, dispatch]);

  return (
    <div className='min-h-screen w-full bg-[var(--color-surface)]'>
      <div className={s.gridContainer}>
        <HeroSection />

        <Flex
          align='center'
          justify='center'
          className='p-6 md:p-8 lg:p-12 overflow-y-auto w-full h-full'
        >
          <div className='w-full max-w-[440px] bg-[var(--color-panel-solid)] rounded-[24px] shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] border border-[var(--gray-a4)] p-8 md:p-10 relative overflow-hidden'>
            {/* Subtle gradient glow inside the card */}
            <div className='absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#667eea] to-[#764ba2]' />
            {children}
          </div>
        </Flex>
      </div>

      <Toast ref={toastRef} />
    </div>
  );
}

UnauthLayout.propTypes = {
  children: PropTypes.node,
};

export default UnauthLayout;
