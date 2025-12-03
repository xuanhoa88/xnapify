/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import PropTypes from 'prop-types';
import s from './Home.css';

function Home({ loading, payload, featuresData }) {
  return (
    <div className={s.root}>
      {/* Features Section */}
      <section className={s.features}>
        <div className={s.container}>
          <div className={s.sectionHeader}>
            <h2 className={s.sectionTitle}>Why Choose React Starter Kit?</h2>
            <p className={s.sectionSubtitle}>
              Everything you need to build modern, scalable web applications
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
            <h2 className={s.sectionTitle}>Latest Updates</h2>
            <p className={s.sectionSubtitle}>
              Stay informed about new features, improvements, and announcements
            </p>
          </div>
          {loading ? (
            <div className={s.loading}>
              <div className={s.spinner}></div>
              <p>Loading latest updates...</p>
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
                          Learn more →
                        </a>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <div className={s.noNews}>
                  <p>No updates available at the moment.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
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
