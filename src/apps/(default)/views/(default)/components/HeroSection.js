/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useTranslation } from 'react-i18next';

import { Link } from '@shared/renderer/components/History';

import s from './HeroSection.css';

/**
 * Hero banner section for the home page
 */
function HeroSection() {
  const { t } = useTranslation();

  return (
    <section className={s.hero}>
      <div className={s.heroContent}>
        <h1 className={s.heroTitle}>{t('home.hero.title', 'xnapify')}</h1>
        <p className={s.heroSubtitle}>
          {t(
            'home.hero.subtitle',
            'A modular, extensible platform with auto-discovered domains, dependency injection, file-based routing, and a runtime extension system',
          )}
        </p>
        <div className={s.heroActions}>
          <a
            href='https://github.com/xuanhoa88/xnapify'
            className={s.btnPrimary}
            target='_blank'
            rel='noopener noreferrer'
          >
            {t('home.hero.viewGithub', 'View on GitHub')}
          </a>
          <Link to='/features' className={s.btnSecondary}>
            {t('home.hero.exploreFeatures', 'Explore Features')}
          </Link>
        </div>
      </div>
    </section>
  );
}

export default HeroSection;
