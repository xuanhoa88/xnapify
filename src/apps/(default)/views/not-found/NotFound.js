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
 * Upgraded to use massive watermark typography and premium button aesthetics.
 */
function NotFound() {
  const { t } = useTranslation();

  return (
    <Box className={s.pageWrapper}>
      <Flex
        direction='column'
        align='center'
        justify='center'
        className={s.contentContainer}
      >
        <Box className={s.watermarkWrapper} aria-hidden='true'>
          404
        </Box>

        <Heading as='h1' className={s.heroTitle}>
          {t('notFound.title', 'Page Not Found')}
        </Heading>

        <Text className={s.heroSubtitle}>
          {t(
            'notFound.message',
            'Sorry, the page you were trying to view does not exist or has been moved.',
          )}
        </Text>

        <Flex gap='4' justify='center' align='center' className={s.actionsRow}>
          <Button asChild size='3' variant='solid'>
            <Link to='/'>{t('notFound.backToHome', 'Back to Home')}</Link>
          </Button>
          <Button
            size='3'
            variant='soft'
            color='gray'
            onClick={() => window.history.back()}
          >
            {t('notFound.goBack', 'Go Back')}
          </Button>
        </Flex>
      </Flex>
    </Box>
  );
}

export default NotFound;
