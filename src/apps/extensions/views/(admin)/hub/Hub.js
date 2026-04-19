/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useEffect, useCallback, useState } from 'react';

import { InfoCircledIcon, MagnifyingGlassIcon } from '@radix-ui/react-icons';
import {
  Box,
  Flex,
  Text,
  Grid,
  Button,
  Select,
  TextField,
} from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import Loader from '@shared/renderer/components/Loader';
import { TablePagination } from '@shared/renderer/components/Table';

import CategoryChips from './components/CategoryChips';
import ListingDetail from './components/ListingDetail';
import MarketplaceCard from './components/MarketplaceCard';
import {
  fetchHubListings,
  fetchFeaturedListings,
  fetchCategories,
  fetchListingDetail,
  getHubListings,
  getHubFeatured,
  getHubCategories,
  getHubFilters,
  getHubTotal,
  getHubTotalPages,
  getSelectedListing,
  isHubBrowseLoading,
  isHubFeaturedLoading,
  isHubInitialized,
  getHubBrowseError,
  setFilter,
  clearSelectedListing,
} from './redux';

import s from './Hub.css';

function Hub() {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  const listings = useSelector(getHubListings);
  const featured = useSelector(getHubFeatured);
  const categories = useSelector(getHubCategories);
  const filters = useSelector(getHubFilters);
  const total = useSelector(getHubTotal);
  const totalPages = useSelector(getHubTotalPages);
  const loading = useSelector(isHubBrowseLoading);
  const featuredLoading = useSelector(isHubFeaturedLoading);
  const initialized = useSelector(isHubInitialized);
  const error = useSelector(getHubBrowseError);
  const selectedListing = useSelector(getSelectedListing);

  const [searchInput, setSearchInput] = useState('');

  useEffect(() => {
    dispatch(fetchFeaturedListings());
    dispatch(fetchCategories());
    dispatch(fetchHubListings(filters));
  }, [dispatch]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = useCallback(() => {
    dispatch(setFilter({ search: searchInput, page: 1 }));
    dispatch(fetchHubListings({ ...filters, search: searchInput, page: 1 }));
  }, [dispatch, searchInput, filters]);

  const handleCategorySelect = useCallback(
    category => {
      dispatch(setFilter({ category, page: 1 }));
      dispatch(fetchHubListings({ ...filters, category, page: 1 }));
    },
    [dispatch, filters],
  );

  const handleCardClick = useCallback(
    listing => {
      dispatch(fetchListingDetail(listing.id));
    },
    [dispatch],
  );

  const handleCloseDetail = useCallback(() => {
    dispatch(clearSelectedListing());
  }, [dispatch]);

  const handlePageChange = useCallback(
    page => {
      dispatch(setFilter({ page }));
      dispatch(fetchHubListings({ ...filters, page }));
    },
    [dispatch, filters],
  );

  const renderHero = () => (
    <Box className={s.heroBox}>
      <Text as='h1' size='8' className={s.heroTitle}>
        {t('admin:hub.title', 'Extension Hub')}
      </Text>
      <Text as='p' size='3' className={s.heroSubtitle}>
        {t(
          'admin:hub.subtitle',
          'Discover and install plugins and modules to extend your application.',
        )}
      </Text>
      <Flex justify='center' align='stretch' className={s.searchFlex}>
        <TextField.Root
          placeholder={t(
            'admin:hub.searchPlaceholder',
            'Search extensions by name or tag...',
          )}
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          className={s.searchInput}
          size='3'
        />
        <Button icon='search' onClick={handleSearch} className={s.searchButton}>
          {t('admin:hub.search', 'Search')}
        </Button>
      </Flex>
    </Box>
  );

  // First-render skeleton — wait until the initial browse completes
  if (!initialized) {
    return (
      <Box className={s.containerBox}>
        {renderHero()}
        <Loader
          variant='skeleton'
          message={t('admin:hub.loading', 'Loading extensions...')}
        />
      </Box>
    );
  }

  if (error) {
    return (
      <Box className={s.containerBox}>
        {renderHero()}
        <Flex
          direction='column'
          align='center'
          justify='center'
          className={s.errorFlex}
        >
          <InfoCircledIcon width={48} className={s.errorIcon} />
          <Text
            as='p'
            size='4'
            weight='bold'
            color='red'
            className={s.errorHeading}
          >
            {t('admin:hub.loadError', 'Failed to load extensions')}
          </Text>
          <Button
            variant='outline'
            onClick={() => {
              dispatch(fetchFeaturedListings());
              dispatch(fetchCategories());
              dispatch(fetchHubListings(filters));
            }}
          >
            {t('admin:hub.retry', 'Retry')}
          </Button>
        </Flex>
      </Box>
    );
  }

  return (
    <Box className={s.containerBox}>
      {renderHero()}

      {/* Featured carousel */}
      {featured.length > 0 && !featuredLoading && (
        <Box className={s.featuredBox}>
          <Text as='h2' size='6' className={s.featuredHeading}>
            {t('admin:hub.featured', 'Featured')}
          </Text>
          <Grid columns={{ initial: '1', md: '2', lg: '4' }} gap='4'>
            {featured.slice(0, 4).map(item => (
              <MarketplaceCard
                key={item.id}
                listing={item}
                onClick={handleCardClick}
                isFeatured
              />
            ))}
          </Grid>
        </Box>
      )}

      {/* Sticky categories & toolbars */}
      <Box className={s.stickyToolbarBox}>
        <CategoryChips
          categories={categories}
          activeCategory={filters.category}
          onSelect={handleCategorySelect}
        />
        <Flex align='center' className={s.toolbarFlex}>
          <Text as='span' size='2' color='gray' weight='bold'>
            {total} {t('admin:hub.results', 'results')}
          </Text>
          <Select.Root
            value={filters.sort}
            onValueChange={sort => {
              dispatch(setFilter({ sort }));
              dispatch(fetchHubListings({ ...filters, sort }));
            }}
          >
            <Select.Trigger className={s.sortSelect} />
            <Select.Content>
              <Select.Item value='popular'>
                {t('admin:hub.sortPopular', 'Most popular')}
              </Select.Item>
              <Select.Item value='recent'>
                {t('admin:hub.sortRecent', 'Recently added')}
              </Select.Item>
              <Select.Item value='name'>
                {t('admin:hub.sortName', 'Name')}
              </Select.Item>
            </Select.Content>
          </Select.Root>
        </Flex>
      </Box>

      {/* Listing grid */}
      {loading ? (
        <Loader />
      ) : (
        <Box>
          {listings.length === 0 ? (
            <Flex
              direction='column'
              align='center'
              justify='center'
              className={s.emptyStateFlex}
            >
              <MagnifyingGlassIcon width={48} className={s.emptyStateIcon} />
              <Text as='p' size='4' weight='bold' color='gray'>
                {t('admin:hub.noResults', 'No extensions found')}
              </Text>
            </Flex>
          ) : (
            <Grid
              columns={{ initial: '1', md: '2', lg: '3' }}
              gap='4'
              className={s.gridBox}
            >
              {listings.map(item => (
                <MarketplaceCard
                  key={item.id}
                  listing={item}
                  onClick={handleCardClick}
                />
              ))}
            </Grid>
          )}
        </Box>
      )}

      {/* Pagination */}
      <TablePagination
        currentPage={filters.page}
        totalPages={totalPages}
        totalItems={total}
        onPageChange={handlePageChange}
        loading={loading}
      />

      {/* Detail drawer */}
      <ListingDetail listing={selectedListing} onClose={handleCloseDetail} />
    </Box>
  );
}

export default Hub;
