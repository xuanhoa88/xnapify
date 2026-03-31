/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import s from './NewsSection.css';

/**
 * News listing section for the home page
 */
function NewsSection({ loading, news }) {
  const { t } = useTranslation();

  return (
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
            {news && news.length > 0 ? (
              news.map((item, index) => (
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
  );
}

NewsSection.propTypes = {
  loading: PropTypes.bool.isRequired,
  news: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.number,
      title: PropTypes.string.isRequired,
      link: PropTypes.string.isRequired,
      contentSnippet: PropTypes.string,
      content: PropTypes.string,
    }),
  ),
};

export default NewsSection;
