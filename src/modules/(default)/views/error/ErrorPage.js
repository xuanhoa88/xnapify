/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Link } from '../../../../components/History';
import Button from '../../../../components/Button';
import s from './ErrorPage.css';

/**
 * Error Page Component
 * Standalone full-page error display without header/footer
 */
function ErrorPage({ error = null }) {
  const { t } = useTranslation();

  // Development mode - show detailed error
  if (__DEV__ && error) {
    return (
      <div className={s.root}>
        <div className={s.hero}>
          <div className={s.heroIcon}>⚠️</div>
          <h1 className={s.heroTitle}>{error.name}</h1>
          <p className={s.heroSubtitle}>{error.message}</p>
        </div>
        <div className={s.content}>
          <div className={s.container}>
            <pre className={s.stackTrace}>{error.stack}</pre>
            <div className={s.actions}>
              <Link to='/' className={s.btnPrimary}>
                {t('error.backToHome', 'Back to Home')}
              </Link>
              <Button
                variant='secondary'
                className={s.btnSecondary}
                onClick={() => window.location.reload()}
              >
                {t('error.tryAgain', 'Try Again')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Production mode - show user-friendly message
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
              onClick={() => window.location.reload()}
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
    name: PropTypes.string.isRequired,
    message: PropTypes.string.isRequired,
    stack: PropTypes.string.isRequired,
  }),
};

export default ErrorPage;
