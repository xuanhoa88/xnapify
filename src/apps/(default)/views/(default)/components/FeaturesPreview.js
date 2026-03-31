/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import s from './FeaturesPreview.css';

/**
 * Features preview grid for the home page
 */
function FeaturesPreview({ featuresData }) {
  const { t } = useTranslation();

  return (
    <section className={s.features}>
      <div className={s.container}>
        <div className={s.sectionHeader}>
          <h2 className={s.sectionTitle}>
            {t('home.features.title', 'Built-In Architecture')}
          </h2>
          <p className={s.sectionSubtitle}>
            {t(
              'home.features.subtitle',
              'Auto-discovered modules, runtime extensions, and a DI-powered lifecycle — all wired for you',
            )}
          </p>
        </div>
        <div className={s.featureGrid}>
          {featuresData.map(feature => (
            <div key={feature.id} className={s.featureCard}>
              <div className={s.featureHeader}>
                <div className={s.featureIcon}>{feature.icon}</div>
                <h3 className={s.featureTitle}>{feature.name}</h3>
              </div>
              <p className={s.featureDesc}>{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

FeaturesPreview.propTypes = {
  featuresData: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      icon: PropTypes.string.isRequired,
      description: PropTypes.string.isRequired,
    }),
  ).isRequired,
};

export default FeaturesPreview;
