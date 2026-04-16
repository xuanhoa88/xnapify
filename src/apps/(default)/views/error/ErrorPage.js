/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import Button from '@shared/renderer/components/Button';
import { Link } from '@shared/renderer/components/History';

import s from './ErrorPage.css';

/**
 * Error Page Component
 * Standalone full-page error display without header/footer
 */
function ErrorPage({ error = null, context }) {
  const { t } = useTranslation();
  const { history } = context;

  // Extract error from direct prop, router context, or initialProps
  const actualError =
    error ||
    (context && context.error) ||
    (context && context.initialProps && context.initialProps.error) ||
    null;

  // Handle 403 Forbidden Error
  if (actualError && actualError.status === 403) {
    return (
      <div className={s.root}>
        <div className={s.hero}>
          <div className={s.heroIcon}>🔒</div>
          <h1 className={s.heroTitle}>
            {t('error.forbidden.title', 'Access Denied')}
          </h1>
          <p className={s.heroSubtitle}>
            {actualError.message ||
              t(
                'error.forbidden.message',
                "You don't have permission to access this page.",
              )}
          </p>
        </div>
        <div className={s.content}>
          <div className={s.container}>
            <div className={s.actions}>
              <Link to='/' className={s.btnPrimary}>
                {t('error.backToHome', 'Back to Home')}
              </Link>
              <Button
                variant='secondary'
                className={s.btnSecondary}
                onClick={function () {
                  history.goBack();
                }}
              >
                {t('error.goBack', 'Go Back')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Handle 404 Not Found
  if (actualError && actualError.status === 404) {
    return (
      <div className={s.root}>
        <div className={s.hero}>
          <div className={s.heroIcon}>🧭</div>
          <h1 className={s.heroTitle}>
            {t('error.notFound.title', 'Page Not Found')}
          </h1>
          <p className={s.heroSubtitle}>
            {t(
              'error.notFound.message',
              "The page you are looking for doesn't exist or has been moved.",
            )}
          </p>
        </div>
        <div className={s.content}>
          <div className={s.container}>
            <div className={s.actions}>
              <Link to='/' className={s.btnPrimary}>
                {t('error.backToHome', 'Back to Home')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Development mode: show error details with stack trace
  if (actualError && (__DEV__ || actualError.stack)) {
    return (
      <div className={s.root}>
        <div className={s.hero}>
          <div className={s.heroIcon}>⚠️</div>
          <h1 className={s.heroTitle}>{actualError.name || 'Error'}</h1>
          <p className={s.heroSubtitle}>{actualError.message}</p>
        </div>
        <div className={s.content}>
          <div className={s.container}>
            {__DEV__ && actualError.stack && (
              <pre className={s.stackTrace} suppressHydrationWarning>
                {actualError.stack}
              </pre>
            )}
            <div className={s.actions}>
              <Link to='/' className={s.btnPrimary}>
                {t('error.backToHome', 'Back to Home')}
              </Link>
              <Button
                variant='secondary'
                className={s.btnSecondary}
                onClick={function () {
                  history.push(history.location.pathname);
                }}
              >
                {t('error.tryAgain', 'Try Again')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Generic fallback
  return (
    <div className={s.root}>
      <div className={s.hero}>
        <div className={s.heroIcon}>😕</div>
        <h1 className={s.heroTitle}>
          {t('error.title', 'Oops! Something went wrong')}
        </h1>
        <p className={s.heroSubtitle}>
          {t('error.message', 'Sorry, a critical error occurred on this page.')}
        </p>
      </div>
      <div className={s.content}>
        <div className={s.container}>
          <div className={s.actions}>
            <Link to='/' className={s.btnPrimary}>
              {t('error.backToHome', 'Back to Home')}
            </Link>
            <Button
              variant='secondary'
              className={s.btnSecondary}
              onClick={function () {
                history.push(history.location.pathname);
              }}
            >
              {t('error.tryAgain', 'Try Again')}
            </Button>
          </div>
        </div>
      </div>
    </div>
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
};

export default ErrorPage;
