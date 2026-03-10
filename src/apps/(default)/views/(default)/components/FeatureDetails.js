/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import Icon from '@shared/renderer/components/Icon';
import { Link } from '@shared/renderer/components/History';
import { featuresData } from '../data';
import s from './FeatureDetails.css';

function FeatureDetails({ featureId }) {
  const { t } = useTranslation();
  const feature = featuresData.find(f => f.id === featureId);

  if (!feature) {
    return (
      <div className={s.root}>
        <section className={s.heroError}>
          <div className={s.heroContent}>
            <h1 className={s.heroTitle}>
              {t('features.notFound.title', '404 - Feature Not Found')}
            </h1>
            <p className={s.heroSubtitle}>
              {t(
                'features.notFound.message',
                'The feature "{{featureId}}" does not exist.',
                { featureId },
              )}
            </p>
            <Link to='/features' className={s.btnPrimary}>
              <Icon name='arrowLeft' />
              {t('features.backToFeatures', 'Back to Features')}
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className={s.root}>
      {/* Hero Section */}
      <section className={s.hero}>
        <div className={s.heroContent}>
          <Link to='/features' className={s.backLink}>
            <Icon name='arrowLeft' />
            {t('features.backToFeatures', 'Back to Features')}
          </Link>
          <div className={s.heroIcon}>{feature.icon}</div>
          <h1 className={s.heroTitle}>{feature.name}</h1>
          <div className={s.heroTags}>
            {feature.tags.map(tag => (
              <span key={tag} className={s.heroTag}>
                {tag}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Content Section */}
      <section className={s.content}>
        <div className={s.container}>
          <div className={s.description}>
            <h2 className={s.sectionTitle}>
              {t('features.overview', 'Overview')}
            </h2>
            <p className={s.descText}>{feature.description}</p>
          </div>

          <div className={s.details}>
            <h2 className={s.sectionTitle}>
              {t('features.details', 'Details')}
            </h2>
            <div className={s.detailsBox}>
              <p>{feature.details}</p>
            </div>
          </div>

          <div className={s.actions}>
            <Link to='/features' className={s.btnSecondary}>
              {t('features.viewAllFeatures', 'View All Features')}
            </Link>
            <Link to='/' className={s.btnPrimary}>
              {t('features.backToHome', 'Back to Home')}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

FeatureDetails.propTypes = {
  featureId: PropTypes.string.isRequired,
};

// Force rebuild
export default FeatureDetails;
