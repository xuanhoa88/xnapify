/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useEffect, useCallback } from 'react';

import { MagnifyingGlassIcon, StarFilledIcon } from '@radix-ui/react-icons';
import { Box, Flex, Text, Grid, Badge, Select } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import Loader from '@shared/renderer/components/Loader';
import {
  TablePagination,
  TableSearch,
  DataTable,
} from '@shared/renderer/components/Table';

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

  useEffect(() => {
    dispatch(fetchFeaturedListings());
    dispatch(fetchCategories());
    dispatch(fetchHubListings(filters));
  }, [dispatch]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCategorySelect = useCallback(
    category => {
      dispatch(setFilter({ category, page: 1 }));
      dispatch(fetchHubListings({ ...filters, category, page: 1 }));
    },
    [dispatch, filters],
  );

  const handleCardClick = useCallback(
    listing => {
      dispatch(fetchListingDetail(listing.name));
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

  const handleRetry = useCallback(() => {
    dispatch(fetchFeaturedListings());
    dispatch(fetchCategories());
    dispatch(fetchHubListings(filters));
  }, [dispatch, filters]);

  const handleSearchChange = useCallback(
    val => {
      dispatch(setFilter({ search: val, page: 1 }));
      dispatch(fetchHubListings({ ...filters, search: val, page: 1 }));
    },
    [dispatch, filters],
  );

  const handleSortChange = useCallback(
    sort => {
      dispatch(setFilter({ sort }));
      dispatch(fetchHubListings({ ...filters, sort }));
    },
    [dispatch, filters],
  );

  // ─── Hero banner ─────────────────────────────────────────────────────
  const renderHero = () => (
    <Box className={s.heroBox}>
      <Text
        as='h1'
        size={{ initial: '8', md: '9' }}
        weight='bold'
        className={s.heroTitle}
      >
        {t('admin:hub.title', 'Extension Hub')}
      </Text>
      <Text as='p' size={{ initial: '3', md: '4' }} className={s.heroSubtitle}>
        {t(
          'admin:hub.subtitle',
          'Discover and install plugins and modules to extend your application.',
        )}
      </Text>
      <Box className={s.searchFlex}>
        <TableSearch
          value={filters.search || ''}
          onChange={handleSearchChange}
          placeholder={t(
            'admin:hub.searchPlaceholder',
            'Search extensions by name or tag...',
          )}
        />
      </Box>
    </Box>
  );

  // ─── First-render skeleton ───────────────────────────────────────────
  if (!initialized) {
    return (
      <Box className={s.containerBox}>
        {renderHero()}
        <Box className={s.browseContentBox}>
          <Loader
            variant='skeleton'
            message={t('admin:hub.loading', 'Loading extensions...')}
          />
        </Box>
      </Box>
    );
  }

  // ─── Error state ─────────────────────────────────────────────────────
  if (error) {
    return (
      <Box className={s.containerBox}>
        {renderHero()}
        <Box className={s.browseContentBox}>
          <DataTable.Error message={error} onRetry={handleRetry} />
        </Box>
      </Box>
    );
  }

  // ─── Main layout ─────────────────────────────────────────────────────
  return (
    <Box className={s.containerBox}>
      {renderHero()}

      {/* Featured carousel */}
      {featured.length > 0 && !featuredLoading && (
        <Box className={s.featuredBox}>
          <Flex align='center' gap='2' className={s.featuredHeaderFlex}>
            <Text as='h2' size='5' weight='bold' className={s.featuredHeading}>
              {t('admin:hub.featured', 'Featured')}
            </Text>
            <Badge
              color='amber'
              variant='soft'
              radius='full'
              className={s.featuredBadge}
            >
              <StarFilledIcon width={12} height={12} />
              {t('admin:hub.curated', 'Curated')}
            </Badge>
          </Flex>
          <Grid columns={{ initial: '1', sm: '2', lg: '4' }} gap='4'>
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

      {/* Browse section — content box (mirrors DataTable chrome) */}
      <Box className={s.browseContentBox}>
        {/* Toolbar: categories + result count + sort */}
        <Box className={s.browseToolbar}>
          <CategoryChips
            categories={categories}
            activeCategory={filters.category}
            onSelect={handleCategorySelect}
          />
          <Flex align='center' justify='between' mt='3'>
            <Text as='span' size='2' color='gray' weight='medium'>
              {t('admin:hub.results', '{{total}} results', { total })}
            </Text>
            <Select.Root value={filters.sort} onValueChange={handleSortChange}>
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
          <>
            {listings.length === 0 ? (
              <DataTable.Empty
                icon={<MagnifyingGlassIcon width={48} height={48} />}
                title={t('admin:hub.noResults', 'No extensions found')}
                description={t(
                  'admin:hub.tryDifferentSearch',
                  'Try a different search term or category.',
                )}
              />
            ) : (
              <Grid
                columns={{ initial: '1', sm: '2', lg: '3' }}
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

            {/* Loading overlay for subsequent fetches */}
            {loading && listings.length > 0 && (
              <Box className={s.loadingOverlay}>
                <Loader variant='spinner' />
              </Box>
            )}
          </>
        )}

        {/* Pagination inside content box */}
        {total > 0 && (
          <Box className={s.paginationBox}>
            <TablePagination
              currentPage={filters.page}
              totalPages={totalPages}
              totalItems={total}
              onPageChange={handlePageChange}
              loading={loading}
            />
          </Box>
        )}
      </Box>

      {/* Detail drawer */}
      <ListingDetail listing={selectedListing} onClose={handleCloseDetail} />
    </Box>
  );
}

export default Hub;
