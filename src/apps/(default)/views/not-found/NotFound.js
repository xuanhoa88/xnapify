/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { Flex, Box, Text, Heading, Button } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';

import { Link } from '@shared/renderer/components/History';

import s from './NotFound.css';

/**
 * Not Found (404) Page Component
 * Standalone full-page display natively mapped to pure Radix Flex definitions
 */
function NotFound() {
  const { t } = useTranslation();

  return (
    <Box className={s.pageContainer}>
      {/* Hero Section */}
      <Flex
        direction='column'
        align='center'
        justify='center'
        className={s.hero}
      >
        <Text className={s.errorCode}>404</Text>
        <Heading as='h1' size='8' mb='3' className={s.heroTitle}>
          {t('notFound.title', 'Page Not Found')}
        </Heading>
        <Text size='4' color='gray' className={s.heroSubtitle}>
          {t(
            'notFound.message',
            'Sorry, the page you were trying to view does not exist.',
          )}
        </Text>
      </Flex>

      {/* Actions Section */}
      <Box className={s.contentWrapper}>
        <Box className={s.contentInner}>
          <Flex gap='4' justify='center' align='center' mt='6'>
            <Button asChild variant='solid' size='3'>
              <Link to='/' className={s.link}>
                {t('notFound.backToHome', 'Back to Home')}
              </Link>
            </Button>
            <Button
              variant='surface'
              size='3'
              color='gray'
              onClick={() => window.history.back()}
            >
              {t('notFound.goBack', 'Go Back')}
            </Button>
          </Flex>
        </Box>
      </Box>
    </Box>
  );
}

export default NotFound;
