/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Link } from '@shared/renderer/components/History';
import Feedback from './Feedback';
import s from './Home.css';

function Home({ loading, payload, featuresData }) {
  const { t } = useTranslation();

  return (
    <div className={s.root}>
      {/* Hero Section */}
      <section className={s.hero}>
        <div className={s.heroContent}>
          <h1 className={s.heroTitle}>
            {t('home.hero.title', 'React Starter Kit')}
          </h1>
          <p className={s.heroSubtitle}>
            {t(
              'home.hero.subtitle',
              'A professional boilerplate for building modern web applications with React, Redux, and server-side rendering',
            )}
          </p>
          <div className={s.heroActions}>
            <a
              href='https://github.com/xuanhoa88/rapid-rsk'
              className={s.btnPrimary}
              target='_blank'
              rel='noopener noreferrer'
            >
              {t('home.hero.viewGithub', 'View on GitHub')}
            </a>
            <Link to='/about' className={s.btnSecondary}>
              {t('home.hero.learnMore', 'Learn More')}
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className={s.features}>
        <div className={s.container}>
          <div className={s.sectionHeader}>
            <h2 className={s.sectionTitle}>
              {t('home.features.title', 'Why Choose React Starter Kit?')}
            </h2>
            <p className={s.sectionSubtitle}>
              {t(
                'home.features.subtitle',
                'Everything you need to build modern, scalable web applications',
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

      {/* News Section */}
      <section className={s.newsSection}>
        <div className={s.container}>
          <div className={s.sectionHeader}>
            <h2 className={s.sectionTitle}>
              {t('home.news.title', 'Latest Updates')}
            </h2>
            <p className={s.sectionSubtitle}>
              {t(
                'home.news.subtitle',
                'Stay informed about new features, improvements, and announcements',
              )}
            </p>
          </div>
          {loading ? (
            <div className={s.loading}>
              <div className={s.spinner}></div>
              <p>{t('home.news.loading', 'Loading latest updates...')}</p>
            </div>
          ) : (
            <div className={s.newsGrid}>
              {payload && payload.length > 0 ? (
                payload.map((item, index) => (
                  <article key={item.id || item.link} className={s.newsItem}>
                    <div className={s.newsContent}>
                      <div className={s.newsNumber}>
                        <span>{String(index + 1).padStart(2, '0')}</span>
                      </div>
                      <div className={s.newsBody}>
                        <h3 className={s.newsTitle}>
                          <a href={item.link}>{item.title}</a>
                        </h3>
                        <p className={s.newsDesc}>
                          {item.contentSnippet || item.content}
                        </p>
                        <a href={item.link} className={s.readMore}>
                          {t('home.news.learnMore', 'Learn more →')}
                        </a>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <div className={s.noNews}>
                  <p>
                    {t(
                      'home.news.noUpdates',
                      'No updates available at the moment.',
                    )}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Feedback Section */}
      <Feedback />
    </div>
  );
}

Home.propTypes = {
  loading: PropTypes.bool.isRequired,
  payload: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.number,
      title: PropTypes.string.isRequired,
      link: PropTypes.string.isRequired,
      contentSnippet: PropTypes.string,
      content: PropTypes.string,
      pubDate: PropTypes.string,
    }),
  ),
  featuresData: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      icon: PropTypes.string.isRequired,
      description: PropTypes.string.isRequired,
      details: PropTypes.string.isRequired,
      tags: PropTypes.arrayOf(PropTypes.string).isRequired,
    }),
  ).isRequired,
};

export default Home;
