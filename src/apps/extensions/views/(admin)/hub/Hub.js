/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useEffect, useCallback, useState } from 'react';

import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import Button from '@shared/renderer/components/Button';
import Icon from '@shared/renderer/components/Icon';
import Loader from '@shared/renderer/components/Loader';
import Pagination from '@shared/renderer/components/Table/Pagination';

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

  const handleSortChange = useCallback(
    e => {
      const sort = e.target.value;
      dispatch(setFilter({ sort }));
      dispatch(fetchHubListings({ ...filters, sort }));
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

  // First-render skeleton — wait until the initial browse completes
  if (!initialized) {
    return (
      <div className={s.root}>
        <div className={s.hero}>
          <div className={s.heroContent}>
            <h1 className={s.heroTitle}>
              {t('admin:hub.title', 'Extension Hub')}
            </h1>
            <p className={s.heroSubtitle}>
              {t(
                'admin:hub.subtitle',
                'Discover and install plugins and modules to extend your application.',
              )}
            </p>
          </div>
        </div>
        <Loader
          variant='skeleton'
          message={t('admin:hub.loading', 'Loading extensions...')}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className={s.root}>
        <div className={s.hero}>
          <div className={s.heroContent}>
            <h1 className={s.heroTitle}>
              {t('admin:hub.title', 'Extension Hub')}
            </h1>
          </div>
        </div>
        <div className={s.empty}>
          <Icon name='alert-circle' size={48} />
          <p>{t('admin:hub.loadError', 'Failed to load extensions')}</p>
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
        </div>
      </div>
    );
  }

  return (
    <div className={s.root}>
      {/* Search Hero */}
      <div className={s.hero}>
        <div className={s.heroContent}>
          <h1 className={s.heroTitle}>
            {t('admin:hub.title', 'Extension Hub')}
          </h1>
          <p className={s.heroSubtitle}>
            {t(
              'admin:hub.subtitle',
              'Discover and install plugins and modules to extend your application.',
            )}
          </p>
          <div className={s.searchBar}>
            <input
              type='text'
              placeholder={t(
                'admin:hub.searchPlaceholder',
                'Search extensions by name or tag...',
              )}
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className={s.searchInput}
            />
            <Button icon='search' onClick={handleSearch} size='large'>
              {t('admin:hub.search', 'Search')}
            </Button>
          </div>
        </div>
      </div>

      {/* Featured carousel */}
      {featured.length > 0 && !featuredLoading && (
        <div className={s.featuredSection}>
          <h2 className={s.sectionTitle}>
            {t('admin:hub.featured', 'Featured')}
          </h2>
          <div className={s.featuredGrid}>
            {featured.slice(0, 4).map(item => (
              <MarketplaceCard
                key={item.id}
                listing={item}
                onClick={handleCardClick}
                isFeatured
              />
            ))}
          </div>
        </div>
      )}

      {/* Sticky categories & toolbars */}
      <div className={s.stickyHeader}>
        <CategoryChips
          categories={categories}
          activeCategory={filters.category}
          onSelect={handleCategorySelect}
        />
        <div className={s.toolbar}>
          <span className={s.resultCount}>
            {total} {t('admin:hub.results', 'results')}
          </span>
          <select
            value={filters.sort}
            onChange={handleSortChange}
            className={s.sortSelect}
          >
            <option value='popular'>
              {t('admin:hub.sortPopular', 'Most popular')}
            </option>
            <option value='recent'>
              {t('admin:hub.sortRecent', 'Recently added')}
            </option>
            <option value='name'>{t('admin:hub.sortName', 'Name')}</option>
          </select>
        </div>
      </div>

      {/* Listing grid */}
      {loading ? (
        <Loader />
      ) : (
        <div className={s.grid}>
          {listings.map(item => (
            <MarketplaceCard
              key={item.id}
              listing={item}
              onClick={handleCardClick}
            />
          ))}
          {listings.length === 0 && (
            <div className={s.empty}>
              <Icon name='search' size={48} />
              <p>{t('admin:hub.noResults', 'No extensions found')}</p>
            </div>
          )}
        </div>
      )}

      {/* Pagination */}
      <Pagination
        currentPage={filters.page}
        totalPages={totalPages}
        totalItems={total}
        onPageChange={handlePageChange}
        loading={loading}
      />

      {/* Detail drawer */}
      <ListingDetail listing={selectedListing} onClose={handleCloseDetail} />
    </div>
  );
}

export default Hub;
