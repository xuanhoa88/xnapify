/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from '../../../../../../components/History';
import ScrollToTop from './ScrollToTop';
import s from './Footer.css';

/**
 * Navigation links configuration
 */
const NAV_LINKS = [
  { to: '/about', key: 'navigation.about' },
  { to: '/privacy', key: 'navigation.privacy' },
  { to: '/contact', key: 'navigation.contact' },
  { to: '/not-found', key: 'navigation.notFound' },
  { to: '/error', key: 'navigation.error' },
];

/**
 * Footer Component
 * Site footer with navigation links and scroll-to-top button
 */
function Footer() {
  const { t } = useTranslation();

  const currentYear = useMemo(() => new Date().getFullYear(), []);

  return (
    <>
      <footer className={s.root}>
        <div className={s.container}>
          <span className={s.text}>
            {t('footer.copyright', { year: currentYear })}
          </span>

          {NAV_LINKS.map(link => (
            <span key={link.to}>
              <span className={s.spacer}>·</span>
              <Link className={s.link} to={link.to}>
                {t(link.key)}
              </Link>
            </span>
          ))}
        </div>
      </footer>

      <ScrollToTop />
    </>
  );
}

export default Footer;
