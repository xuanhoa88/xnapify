/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { Flex, Box, Text, Heading, Grid } from '@radix-ui/themes';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import s from './NewsSection.css';

/**
 * News listing section rewriting explicit layout without legacy CSS implementations avoiding implicit container skews.
 */
function NewsSection({ loading, news }) {
  const { t } = useTranslation();

  return (
    <Box as='section' className={clsx(s.newsBg, s.sectionPadding)}>
      <Box className={s.maxWidth1200}>
        <Flex
          direction='column'
          align='center'
          className={clsx(s.textCenter, s.mb8)}
        >
          <Heading as='h2' size='8' className={clsx(s.textGray12, s.mb3)}>
            {t('home.news.title', 'Latest Updates')}
          </Heading>
          <Text size='4' color='gray' className={s.maxWidth600}>
            {t(
              'home.news.subtitle',
              'Stay informed about new features, improvements, and announcements',
            )}
          </Text>
        </Flex>

        {loading ? (
          <Flex align='center' justify='center' gap='3' className={s.p8}>
            <Box className={s.spinningLoader} />
            <Text size='3' color='gray'>
              {t('home.news.loading', 'Loading latest updates...')}
            </Text>
          </Flex>
        ) : (
          <Box>
            {news && news.length > 0 ? (
              <Grid columns={{ initial: '1', md: '2' }} gap='5'>
                {news.map((item, index) => (
                  <Flex
                    asChild
                    key={item.id || item.link}
                    className={s.newsCard}
                  >
                    <article>
                      <Flex gap='4'>
                        <Box className={s.flexShrink0}>
                          <Flex
                            align='center'
                            justify='center'
                            className={s.boldNumber}
                          >
                            {String(index + 1).padStart(2, '0')}
                          </Flex>
                        </Box>
                        <Box className={s.flex1}>
                          <Heading as='h3' size='4' className={s.mb2}>
                            <a href={item.link} className={s.newsLink}>
                              {item.title}
                            </a>
                          </Heading>
                          <Text
                            size='3'
                            color='gray'
                            className={clsx(s.lineClamp3, s.mb3)}
                          >
                            {item.contentSnippet || item.content}
                          </Text>
                          <Box asChild className={s.learnMoreLink}>
                            <a href={item.link}>
                              {t('home.news.learnMore', 'Learn more →')}
                            </a>
                          </Box>
                        </Box>
                      </Flex>
                    </article>
                  </Flex>
                ))}
              </Grid>
            ) : (
              <Flex
                justify='center'
                className={clsx(s.p8, s.lightGreyBg, s.radius4)}
              >
                <Text size='3' color='gray'>
                  {t(
                    'home.news.noUpdates',
                    'No updates available at the moment.',
                  )}
                </Text>
              </Flex>
            )}
          </Box>
        )}
      </Box>
    </Box>
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
