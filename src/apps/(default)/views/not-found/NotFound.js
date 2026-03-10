/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useTranslation } from 'react-i18next';
import { Link } from '@shared/renderer/components/History';
import Button from '@shared/renderer/components/Button';
import s from './NotFound.css';

/**
 * Not Found (404) Page Component
 * Standalone full-page display without header/footer
 */
function NotFound() {
  const { t } = useTranslation();

  return (
    <div className={s.root}>
      {/* Hero Section */}
      <div className={s.hero}>
        <div className={s.heroCode}>404</div>
        <h1 className={s.heroTitle}>{t('notFound.title', 'Page Not Found')}</h1>
        <p className={s.heroSubtitle}>
          {t(
            'notFound.message',
            'Sorry, the page you were trying to view does not exist.',
          )}
        </p>
      </div>

      {/* Actions Section */}
      <div className={s.content}>
        <div className={s.container}>
          <div className={s.actions}>
            <Link to='/' className={s.btnPrimary}>
              {t('notFound.backToHome', 'Back to Home')}
            </Link>
            <Button
              variant='secondary'
              className={s.btnSecondary}
              onClick={() => window.history.back()}
            >
              {t('notFound.goBack', 'Go Back')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default NotFound;
