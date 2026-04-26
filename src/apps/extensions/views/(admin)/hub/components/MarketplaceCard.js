/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { CheckIcon, DownloadIcon } from '@radix-ui/react-icons';
import { Flex, Box, Text, Badge, Card, Avatar } from '@radix-ui/themes';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import getCategoryIcon from './getCategoryIcon';

import s from './MarketplaceCard.css';

export default function MarketplaceCard({
  listing,
  onClick,
  isFeatured = false,
}) {
  const { t } = useTranslation();
  const isOfficial = listing.author === 'xnapify Team';

  return (
    <Card
      asChild
      variant={isFeatured ? 'classic' : 'surface'}
      className={clsx(s.cardFlex, isFeatured && s.cardFeatured)}
    >
      <Flex
        direction='column'
        onClick={() => onClick(listing)}
        role='button'
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && onClick(listing)}
      >
        <Flex gap='3' align='start' className={s.headerFlex}>
          <Avatar
            size={isFeatured ? '5' : '4'}
            src={listing.icon}
            fallback={(() => {
              const Comp = getCategoryIcon(listing.category);
              return (
                <Comp
                  width={isFeatured ? 28 : 24}
                  height={isFeatured ? 28 : 24}
                />
              );
            })()}
            radius='medium'
            color='indigo'
            variant='soft'
            className={s.avatar}
          />
          <Box className={s.infoBox}>
            <Text
              as='h3'
              size={isFeatured ? '4' : '3'}
              weight='bold'
              className={s.titleText}
            >
              {listing.name}
            </Text>
            {listing.author && (
              <Flex align='center' gap='1'>
                <Text as='span' size='1' color='gray'>
                  {t('admin:hub.byAuthor', 'by {{author}}', {
                    author: listing.author,
                  })}
                </Text>
                {isOfficial && (
                  <Badge
                    size='small'
                    className={s.officialBadge}
                    color='indigo'
                    radius='full'
                    variant='soft'
                  >
                    <CheckIcon width={10} height={10} className={s.checkIcon} />
                    Official
                  </Badge>
                )}
              </Flex>
            )}
          </Box>
        </Flex>

        <Box className={s.descriptionBox}>
          <Text
            as='p'
            size='2'
            color='gray'
            className={clsx(
              s.descText,
              isFeatured ? s.descTextFeatured : s.descTextNormal,
            )}
          >
            {listing.short_description || listing.description}
          </Text>
        </Box>

        <Flex align='center' justify='between' className={s.footerFlex}>
          <Badge size='small' color='gray' radius='full' variant='surface'>
            {listing.category}
          </Badge>
          <Flex gap='3' align='center'>
            <Flex align='center' gap='1' className={s.downloadsFlex}>
              <DownloadIcon width={14} height={14} />
              <Text as='span' size='1' weight='medium'>
                {(listing.install_count || 0).toLocaleString()}
              </Text>
            </Flex>
            <Text as='span' size='1' color='gray'>
              v{listing.version}
            </Text>
          </Flex>
        </Flex>
      </Flex>
    </Card>
  );
}

MarketplaceCard.propTypes = {
  listing: PropTypes.object.isRequired,
  onClick: PropTypes.func.isRequired,
  isFeatured: PropTypes.bool,
};
