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

function HeroSection({ icon, title, subtitle }) {
  return (
    <Flex direction='column' align='center' justify='center' className={s.hero}>
      <Text size='9' mb='4' className={s.heroIcon}>
        {icon}
      </Text>
      <Heading as='h1' size='8' mb='3' className={s.heroTitle}>
        {title}
      </Heading>
      <Text size='4' color='gray' className={s.heroSubtitle}>
        {subtitle}
      </Text>
    </Flex>
  );
}
HeroSection.propTypes = {
  icon: PropTypes.node,
  title: PropTypes.node,
  subtitle: PropTypes.node,
};

function ContentSection({ children }) {
  return (
    <Box className={s.contentWrapper}>
      <Box className={s.contentInner}>{children}</Box>
    </Box>
  );
}
ContentSection.propTypes = { children: PropTypes.node };

function ActionsRow({ children }) {
  return (
    <Flex gap='4' justify='center' align='center' mt='6'>
      {children}
    </Flex>
  );
}
ActionsRow.propTypes = { children: PropTypes.node };

function PrimaryLink({ to, children }) {
  return (
    <Button asChild variant='solid' size='3'>
      <Link to={to} className={s.link}>
        {children}
      </Link>
    </Button>
  );
}
PrimaryLink.propTypes = { to: PropTypes.string, children: PropTypes.node };

/**
 * Error Page Component
 * Standalone full-page error display without header/footer recursively utilizing Radix UI elements.
 */
function ErrorPage({ error = null, context }) {
  const { t } = useTranslation();
  const { history } = context || {};

  // Extract error from direct prop, router context, or initialProps
  const actualError =
    error ||
    (context && context.error) ||
    (context && context.initialProps && context.initialProps.error) ||
    null;

  const PageContainer = ({ children }) => (
    <Box className={s.pageContainer}>{children}</Box>
  );

  // Handle 403 Forbidden Error
  if (actualError && actualError.status === 403) {
    return (
      <PageContainer>
        <HeroSection
          icon='🔒'
          title={t('error.forbidden.title', 'Access Denied')}
          subtitle={
            actualError.message ||
            t(
              'error.forbidden.message',
              "You don't have permission to access this page.",
            )
          }
        />
        <ContentSection>
          <ActionsRow>
            <PrimaryLink to='/'>
              {t('error.backToHome', 'Back to Home')}
            </PrimaryLink>
            {history && (
              <Button
                variant='surface'
                size='3'
                color='gray'
                onClick={function () {
                  history.goBack();
                }}
              >
                {t('error.goBack', 'Go Back')}
              </Button>
            )}
          </ActionsRow>
        </ContentSection>
      </PageContainer>
    );
  }

  // Handle 404 Not Found
  if (actualError && actualError.status === 404) {
    return (
      <PageContainer>
        <HeroSection
          icon='🧭'
          title={t('error.notFound.title', 'Page Not Found')}
          subtitle={t(
            'error.notFound.message',
            "The page you are looking for doesn't exist or has been moved.",
          )}
        />
        <ContentSection>
          <ActionsRow>
            <PrimaryLink to='/'>
              {t('error.backToHome', 'Back to Home')}
            </PrimaryLink>
          </ActionsRow>
        </ContentSection>
      </PageContainer>
    );
  }

  // Development mode: show error details with stack trace
  if (actualError && (__DEV__ || actualError.stack)) {
    return (
      <PageContainer>
        <HeroSection
          icon='⚠️'
          title={actualError.name || 'Error'}
          subtitle={actualError.message}
        />
        <ContentSection>
          {__DEV__ && actualError.stack && (
            <Box as='pre' suppressHydrationWarning className={s.stackTrace}>
              {actualError.stack}
            </Box>
          )}
          <ActionsRow>
            <PrimaryLink to='/'>
              {t('error.backToHome', 'Back to Home')}
            </PrimaryLink>
            {history && (
              <Button
                variant='surface'
                size='3'
                color='gray'
                onClick={function () {
                  history.push(history.location.pathname);
                }}
              >
                {t('error.tryAgain', 'Try Again')}
              </Button>
            )}
          </ActionsRow>
        </ContentSection>
      </PageContainer>
    );
  }

  // Generic fallback
  return (
    <PageContainer>
      <HeroSection
        icon='😕'
        title={t('error.title', 'Oops! Something went wrong')}
        subtitle={t(
          'error.message',
          'Sorry, a critical error occurred on this page.',
        )}
      />
      <ContentSection>
        <ActionsRow>
          <PrimaryLink to='/'>
            {t('error.backToHome', 'Back to Home')}
          </PrimaryLink>
          {history && (
            <Button
              variant='surface'
              size='3'
              color='gray'
              onClick={function () {
                history.push(history.location.pathname);
              }}
            >
              {t('error.tryAgain', 'Try Again')}
            </Button>
          )}
        </ActionsRow>
      </ContentSection>
    </PageContainer>
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
