/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useEffect, useRef } from 'react';

import { Box, Grid, Flex, Text, Heading } from '@radix-ui/themes';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import { Link } from '@shared/renderer/components/History';
import Toast from '@shared/renderer/components/Toast';
import { getFlashMessage, clearFlashMessage } from '@shared/renderer/redux';

import s from './_layout.css';

/**
 * Hero Section - Enterprise-grade deep slate with animated mesh gradients
 */
function HeroSection() {
  const { t } = useTranslation();

  return (
    <Box className='hidden lg:flex items-center justify-center p-12 relative w-full h-full bg-slate-950 overflow-hidden m-0'>
      {/* Animated Mesh Gradient Background */}
      <Box
        className={clsx(
          'absolute top-[-20%] left-[-10%] w-[70%] h-[70%] rounded-full mix-blend-screen filter blur-[100px] opacity-30 animate-pulse',
          s.meshGradient1,
        )}
      />
      <Box
        className={clsx(
          'absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full mix-blend-screen filter blur-[120px] opacity-20 animate-pulse',
          s.meshGradient2,
        )}
      />

      {/* Subtle Noise Texture for Premium Matte Finish */}
      <Box
        className={clsx(
          'absolute inset-0 opacity-[0.03] pointer-events-none',
          s.noiseTexture,
        )}
      />

      <Box className='text-center relative z-10 flex flex-col items-center'>
        <Link
          to='/'
          className='inline-flex items-center gap-4 no-underline mb-12 hover:-translate-y-1 transition-transform duration-300 group'
        >
          <Box className='relative overflow-hidden rounded-xl w-14 h-14 shadow-2xl shadow-indigo-500/20 ring-1 ring-white/10 group-hover:ring-indigo-500/50 transition-all'>
            <img
              src='/xnapify_72x72.png'
              alt='xnapify'
              className='object-cover w-full h-full'
            />
          </Box>
          <Text size='6' weight='bold' className='text-white tracking-tight'>
            xnapify
          </Text>
        </Link>
        <Heading
          as='h1'
          weight='bold'
          className={clsx(
            'text-white mb-6 tracking-tighter leading-tight max-w-[480px]',
            s.heroHeading,
          )}
        >
          {t('unauth.heroTitle', 'Welcome to xnapify')}
        </Heading>
        <Text
          as='p'
          size='5'
          className='text-slate-400 leading-relaxed max-w-[420px] mx-auto font-medium'
        >
          {t(
            'unauth.heroSubtitle',
            'The enterprise platform for modern teams.',
          )}
        </Text>
      </Box>
    </Box>
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
    <>
      <Grid
        columns={{ initial: '1', lg: '2' }}
        className='fixed inset-0 m-0 p-0 overflow-hidden bg-white z-50'
      >
        <HeroSection />

        <Box className='relative w-full h-full bg-white'>
          {/* Subtle background decoration for the right pane */}
          <Box className='absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-indigo-50 rounded-full filter blur-[100px] opacity-60 pointer-events-none' />

          <Flex
            direction='column'
            align='center'
            justify='center'
            className='min-h-full w-full py-12'
          >
            <Box
              className={clsx(
                'w-full max-w-[440px] px-6 relative z-10',
                s.animateSlideUp,
              )}
            >
              {children}
            </Box>
          </Flex>
        </Box>

        <Toast ref={toastRef} />
      </Grid>
    </>
  );
}

UnauthLayout.propTypes = {
  children: PropTypes.node,
};

export default UnauthLayout;
