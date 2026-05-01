/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { CheckIcon } from '@radix-ui/react-icons';
import { Flex, Box, Text, Badge, Card, Avatar } from '@radix-ui/themes';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import getCategoryIcon from './getCategoryIcon';

import s from './MarketplaceCard.css';

/**
 * Detect whether a string is an emoji (non-URL) icon.
 * URLs start with http:// or https://, everything else is treated as emoji.
 */
const isEmojiIcon = icon => icon && !icon.startsWith('http');

export default function MarketplaceCard({
  listing,
  onClick,
  isFeatured = false,
}) {
  const { t } = useTranslation();
  const isOfficial =
    listing.author && listing.author.toLowerCase().includes('xnapify');

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
            src={isEmojiIcon(listing.icon) ? undefined : listing.icon}
            fallback={
              isEmojiIcon(listing.icon) ? (
                <Text as='span' size={isFeatured ? '6' : '5'}>
                  {listing.icon}
                </Text>
              ) : (
                (() => {
                  const Comp = getCategoryIcon(listing.category);
                  return (
                    <Comp
                      width={isFeatured ? 28 : 24}
                      height={isFeatured ? 28 : 24}
                    />
                  );
                })()
              )
            }
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
                    size='1'
                    className={s.officialBadge}
                    color='indigo'
                    radius='full'
                    variant='soft'
                  >
                    <CheckIcon width={10} height={10} className={s.checkIcon} />
                    {t('admin:hub.officialBadge', 'Official')}
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
          <Badge size='1' color='gray' radius='full' variant='surface'>
            {listing.category}
          </Badge>
          <Flex gap='2' align='center'>
            {listing.updateAvailable && (
              <Badge size='1' color='amber' radius='full' variant='soft'>
                {t('admin:hub.updateBadge', 'Update')}
              </Badge>
            )}
            {listing.installed && !listing.updateAvailable && (
              <Badge size='1' color='green' radius='full' variant='soft'>
                {t('admin:hub.installedBadge', 'Installed')}
              </Badge>
            )}
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
