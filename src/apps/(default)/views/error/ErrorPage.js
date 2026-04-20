/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { Flex, Box, Text, Heading, Button } from '@radix-ui/themes';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import { Link } from '@shared/renderer/components/History';

import s from './ErrorPage.css';

/**
 * Error Page Component
 * Upgraded to use massive watermark typography and premium button aesthetics.
 */
function ErrorPage({ error = null, context }) {
  const { t } = useTranslation();
  const { history } = context || {};

  const actualError =
    error ||
    (context && context.error) ||
    (context && context.initialProps && context.initialProps.error) ||
    null;

  let errorCode = 'Error';
  let title = t('error.title', 'Oops! Something went wrong');
  let subtitle = t(
    'error.message',
    'Sorry, a critical error occurred on this page.',
  );

  if (actualError && actualError.status === 403) {
    errorCode = '403';
    title = t('error.forbidden.title', 'Access Denied');
    subtitle =
      actualError.message ||
      t(
        'error.forbidden.message',
        "You don't have permission to access this page.",
      );
  } else if (actualError && actualError.status === 404) {
    errorCode = '404';
    title = t('error.notFound.title', 'Page Not Found');
    subtitle = t(
      'error.notFound.message',
      "The page you are looking for doesn't exist or has been moved.",
    );
  } else if (actualError && (__DEV__ || actualError.stack)) {
    errorCode = '500';
    title = actualError.name || 'Error';
    subtitle = actualError.message;
  }

  return (
    <Box className={s.pageWrapper}>
      <Flex
        direction='column'
        align='center'
        justify='center'
        className={s.contentContainer}
      >
        <Box className={s.watermarkWrapper} aria-hidden='true'>
          {errorCode}
        </Box>

        <Heading as='h1' className={s.heroTitle}>
          {title}
        </Heading>

        <Text className={s.heroSubtitle}>{subtitle}</Text>

        {__DEV__ && actualError && actualError.stack && (
          <Box as='pre' suppressHydrationWarning className={s.stackTrace}>
            {actualError.stack}
          </Box>
        )}

        <Flex gap='4' justify='center' align='center' className={s.actionsRow}>
          <Button asChild size='3' variant='solid'>
            <Link to='/'>{t('error.backToHome', 'Back to Home')}</Link>
          </Button>
          {history && (
            <Button
              size='3'
              variant='soft'
              color='gray'
              onClick={() => {
                if (actualError && actualError.status === 403) {
                  history.goBack();
                } else {
                  history.push(history.location.pathname);
                }
              }}
            >
              {actualError && actualError.status === 403
                ? t('error.goBack', 'Go Back')
                : t('error.tryAgain', 'Try Again')}
            </Button>
          )}
        </Flex>
      </Flex>
    </Box>
  );
}

ErrorPage.propTypes = {
  error: PropTypes.shape({
    name: PropTypes.string,
    message: PropTypes.string,
    stack: PropTypes.string,
    status: PropTypes.number,
  }),
  context: PropTypes.object,
  children: PropTypes.node,
};

export default ErrorPage;
