/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useTranslation } from 'react-i18next';
import { Link } from '../../../../components/History';
import { featuresData } from './data';
import s from './Features.css';

function Features() {
  const { t } = useTranslation();

  return (
    <div className={s.root}>
      {/* Hero Section */}
      <section className={s.hero}>
        <div className={s.heroContent}>
          <h1 className={s.heroTitle}>
            {t('features.hero.title', 'Our Features')}
          </h1>
          <p className={s.heroSubtitle}>
            {t(
              'features.hero.subtitle',
              'Discover the powerful features that make this starter kit amazing',
            )}
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section className={s.features}>
        <div className={s.container}>
          <div className={s.grid}>
            {featuresData.map(feature => (
              <Link
                key={feature.id}
                to={`/features/${feature.id}`}
                className={s.card}
              >
                <div className={s.cardHeader}>
                  <div className={s.icon}>{feature.icon}</div>
                  <h3 className={s.cardTitle}>{feature.name}</h3>
                </div>
                <p className={s.cardDesc}>{feature.description}</p>
                <div className={s.tags}>
                  {feature.tags.map(tag => (
                    <span key={tag} className={s.tag}>
                      {tag}
                    </span>
                  ))}
                </div>
                <span className={s.link}>
                  {t('features.learnMore', 'Learn more →')}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

export default Features;
