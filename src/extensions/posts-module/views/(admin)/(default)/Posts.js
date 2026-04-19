/**
 * Posts admin listing page
 */
import { useEffect, useState, useCallback } from 'react';

import {
  ReaderIcon,
  Cross2Icon,
  MagnifyingGlassIcon,
  Pencil2Icon,
  TrashIcon,
} from '@radix-ui/react-icons';
import {
  Flex,
  Heading,
  Text,
  Box,
  Table,
  Button,
  Badge,
} from '@radix-ui/themes';
import clsx from 'clsx';
import format from 'date-fns/format';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import Loader from '@shared/renderer/components/Loader';
import Modal from '@shared/renderer/components/Modal';
import { useRbac } from '@shared/renderer/components/Rbac';
import { SearchableSelect } from '@shared/renderer/components/SearchableSelect';
import {
  TablePagination,
  TableSearch,
} from '@shared/renderer/components/Table';

import {
  fetchPosts,
  deletePost,
  getPosts,
  getPostsPagination,
  isPostsListLoading,
  isPostsListInitialized,
  getPostsListError,
  isPostDeleteLoading,
} from '../redux';

import PostForm from './PostForm';
import SeoPreview from './SeoPreview';

import s from './Posts.css';

function Posts() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { hasPermission } = useRbac();

  const canCreate = hasPermission('posts:create');
  const canUpdate = hasPermission('posts:update');
  const canDelete = hasPermission('posts:delete');

  const posts = useSelector(getPosts);
  const pagination = useSelector(getPostsPagination);
  const loading = useSelector(isPostsListLoading);
  const initialized = useSelector(isPostsListInitialized);
  const error = useSelector(getPostsListError);
  const deleting = useSelector(isPostDeleteLoading);

  // Filter state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [seoPost, setSeoPost] = useState(null);
  const [formPost, setFormPost] = useState(null);
  const isFormOpen = formPost !== null;

  useEffect(() => {
    dispatch(
      fetchPosts({
        page: currentPage,
        search,
        status: statusFilter,
      }),
    );
  }, [dispatch, currentPage, search, statusFilter]);

  const refreshPosts = useCallback(() => {
    dispatch(
      fetchPosts({
        page: currentPage,
        search,
        status: statusFilter,
      }),
    );
  }, [dispatch, currentPage, search, statusFilter]);

  // Filter handlers
  const handleSearchChange = useCallback(value => {
    setSearch(value);
    setCurrentPage(1);
  }, []);

  const handleStatusFilterChange = useCallback(value => {
    setStatusFilter(value);
    setCurrentPage(1);
  }, []);

  const handleClearAllFilters = useCallback(() => {
    setSearch('');
    setStatusFilter('');
    setCurrentPage(1);
  }, []);

  const hasActiveFilters = search || statusFilter;

  const handleDelete = useCallback(post => {
    setDeleteTarget(post);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    await dispatch(deletePost(deleteTarget.id)).unwrap();
    setDeleteTarget(null);
    refreshPosts();
  }, [dispatch, deleteTarget, refreshPosts]);

  // Loading state — first fetch or loading with no data
  if (!initialized || (loading && posts.length === 0)) {
    return (
      <Box className={s.container}>
        <Flex
          align='center'
          justify='between'
          wrap='wrap'
          gap='4'
          className={s.headerRow}
        >
          <Flex align='center' gap='3'>
            <Flex align='center' justify='center' className={s.iconBox}>
              <ReaderIcon width={24} height={24} />
            </Flex>
            <Flex direction='column'>
              <Heading size='6' className={s.heading}>
                {t('posts:title', 'Posts')}
              </Heading>
              <Text size='3' color='gray' className={s.subheading}>
                {t('posts:subtitle', 'Create and manage your content')}
              </Text>
            </Flex>
          </Flex>
        </Flex>
        <Loader
          variant='skeleton'
          message={t('posts:loading', 'Loading posts...')}
        />
      </Box>
    );
  }

  // Error state
  if (error) {
    return (
      <Box className={s.container}>
        <Flex
          align='center'
          justify='between'
          wrap='wrap'
          gap='4'
          className={s.headerRow}
        >
          <Flex align='center' gap='3'>
            <Flex align='center' justify='center' className={s.iconBox}>
              <ReaderIcon width={24} height={24} />
            </Flex>
            <Flex direction='column'>
              <Heading size='6' className={s.heading}>
                {t('posts:title', 'Posts')}
              </Heading>
              <Text size='3' color='gray' className={s.subheading}>
                {t('posts:subtitle', 'Create and manage your content')}
              </Text>
            </Flex>
          </Flex>
        </Flex>
        <Flex
          direction='column'
          align='center'
          justify='center'
          p='6'
          className={s.errorContainer}
        >
          <Text color='red' size='4' weight='bold' mb='2'>
            {t('posts:errors.load', 'Error loading posts')}
          </Text>
          <Text color='red' size='2' mb='4'>
            {error}
          </Text>
          <Button variant='soft' color='red' onClick={refreshPosts}>
            {t('common:retry', 'Retry')}
          </Button>
        </Flex>
      </Box>
    );
  }

  return (
    <Box className={s.container}>
      <Flex
        align='center'
        justify='between'
        wrap='wrap'
        gap='4'
        className={s.headerRow}
      >
        <Flex align='center' gap='3'>
          <Flex align='center' justify='center' className={s.iconBox}>
            <ReaderIcon width={24} height={24} />
          </Flex>
          <Flex direction='column'>
            <Heading size='6' className={s.heading}>
              {t('posts:title', 'Posts')}
            </Heading>
            <Text size='3' color='gray' className={s.subheading}>
              {t('posts:subtitle', 'Create and manage your content')}
            </Text>
          </Flex>
        </Flex>
        <Flex align='center' gap='3'>
          <Button
            variant='solid'
            color='indigo'
            onClick={() => setFormPost({})}
            {...(!canCreate && {
              disabled: true,
              title: t(
                'posts:noPermissionToCreate',
                'You do not have permission to create posts',
              ),
            })}
          >
            {t('posts:addPost', 'Add Post')}
          </Button>
        </Flex>
      </Flex>

      <Box className={s.tableContainer}>
        <Box className={s.searchHeader}>
          <TableSearch
            value={search}
            onChange={handleSearchChange}
            placeholder={t('posts:search', 'Search posts...')}
          >
            <Flex gap='2' align='center'>
              <Box className={s.searchSelectBox}>
                <SearchableSelect
                  options={[
                    {
                      value: '',
                      label: t('posts:filter.allStatus', 'All Status'),
                    },
                    { value: 'draft', label: t('posts:filter.draft', 'Draft') },
                    {
                      value: 'published',
                      label: t('posts:filter.published', 'Published'),
                    },
                    {
                      value: 'archived',
                      label: t('posts:filter.archived', 'Archived'),
                    },
                  ]}
                  value={statusFilter}
                  onChange={handleStatusFilterChange}
                  placeholder={t('posts:filter.allStatus', 'All Status')}
                  showSearch={false}
                />
              </Box>
              {hasActiveFilters && (
                <Button
                  variant='ghost'
                  size='1'
                  onClick={handleClearAllFilters}
                  type='button'
                  title={t('posts:filter.resetAll', 'Reset all filters')}
                >
                  <Cross2Icon width={12} height={12} />
                  {t('posts:filter.clearFilters', 'Clear Filters')}
                </Button>
              )}
            </Flex>
          </TableSearch>
        </Box>

        <Box className={s.tableWrapper}>
          <Table.Root variant='surface'>
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>
                  {t('posts:table.title', 'Title')}
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>
                  {t('posts:table.status', 'Status')}
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>
                  {t('posts:table.date', 'Date')}
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell className={s.actionColumn}>
                  Actions
                </Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {posts.length === 0 ? (
                <Table.Row>
                  <Table.Cell colSpan={4}>
                    <Flex
                      justify='center'
                      align='center'
                      direction='column'
                      py='9'
                      className={s.emptyState}
                    >
                      <ReaderIcon
                        width={48}
                        height={48}
                        className={s.emptyIcon}
                      />

                      <Text size='3' weight='bold'>
                        {t('posts:empty.title', 'No posts yet')}
                      </Text>
                      <Text size='2' className={s.emptyDescription}>
                        {t(
                          'posts:empty.description',
                          'Create your first post to get started.',
                        )}
                      </Text>
                      <Button
                        variant='solid'
                        color='indigo'
                        onClick={() => setFormPost({})}
                        {...(!canCreate && {
                          disabled: true,
                          title: t(
                            'posts:noPermissionToCreate',
                            'You do not have permission to create posts',
                          ),
                        })}
                      >
                        {t('posts:addPost', 'Add Post')}
                      </Button>
                    </Flex>
                  </Table.Cell>
                </Table.Row>
              ) : (
                posts.map(post => (
                  <Table.Row key={post.id}>
                    <Table.Cell>
                      <Flex direction='column' gap='1'>
                        <Text weight='bold' size='3' className={s.titleText}>
                          {post.title}
                        </Text>
                        {post.excerpt && (
                          <Text size='2' color='gray' className={s.excerptText}>
                            {post.excerpt}
                          </Text>
                        )}
                      </Flex>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge
                        color={
                          post.status === 'published'
                            ? 'green'
                            : post.status === 'archived'
                              ? 'red'
                              : 'yellow'
                        }
                        variant={post.status === 'draft' ? 'surface' : 'soft'}
                        radius='full'
                      >
                        {post.status === 'draft'
                          ? t('posts:status.draft', 'Draft')
                          : post.status === 'published'
                            ? t('posts:status.published', 'Published')
                            : post.status === 'archived'
                              ? t('posts:status.archived', 'Archived')
                              : post.status}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      {post.created_at
                        ? format(new Date(post.created_at), 'MMM dd, yyyy')
                        : '—'}
                    </Table.Cell>
                    <Table.Cell className={s.actionCell}>
                      <Flex gap='2' justify='end'>
                        <Button
                          variant='ghost'
                          size='1'
                          title={t('posts:seoPreview', 'SEO Preview')}
                          onClick={() => setSeoPost(post)}
                        >
                          <MagnifyingGlassIcon width={16} height={16} />
                        </Button>
                        <Button
                          variant='ghost'
                          size='1'
                          onClick={() => setFormPost(post)}
                          {...(!canUpdate && {
                            disabled: true,
                            title: t(
                              'posts:noPermissionToUpdate',
                              'You do not have permission to edit posts',
                            ),
                          })}
                          {...(canUpdate && { title: t('posts:edit', 'Edit') })}
                        >
                          <Pencil2Icon width={16} height={16} />
                        </Button>
                        <Button
                          variant='ghost'
                          size='1'
                          onClick={() => handleDelete(post)}
                          {...(!canDelete && {
                            disabled: true,
                            title: t(
                              'posts:noPermissionToDelete',
                              'You do not have permission to delete posts',
                            ),
                          })}
                          className={clsx(canDelete && s.deleteAction)}
                          {...(canDelete && {
                            title: t('posts:delete', 'Delete'),
                          })}
                        >
                          <TrashIcon width={16} height={16} />
                        </Button>
                      </Flex>
                    </Table.Cell>
                  </Table.Row>
                ))
              )}
            </Table.Body>
          </Table.Root>
          {loading && posts.length > 0 && (
            <Box className={s.loadingOverlay}>
              <Loader variant='spinner' />
            </Box>
          )}
        </Box>

        {pagination && pagination.pages > 1 && (
          <Box p='4' className={s.paginationContainer}>
            <TablePagination
              currentPage={currentPage}
              totalPages={pagination.pages}
              totalItems={pagination.total}
              onPageChange={setCurrentPage}
              loading={loading}
            />
          </Box>
        )}
      </Box>

      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <Modal.Header onClose={() => setDeleteTarget(null)}>
          {t('posts:deleteConfirm.title', 'Delete Post')}
        </Modal.Header>
        <Modal.Body>
          {t(
            'posts:deleteConfirm.message',
            'Are you sure you want to delete this post? This action cannot be undone.',
          )}
        </Modal.Body>
        <Modal.Footer>
          <Modal.Actions>
            <Modal.Button onClick={() => setDeleteTarget(null)}>
              {t('common:cancel', 'Cancel')}
            </Modal.Button>
            <Modal.Button
              variant='primary'
              onClick={handleConfirmDelete}
              disabled={deleting}
            >
              {t('posts:deleteConfirm.confirm', 'Delete')}
            </Modal.Button>
          </Modal.Actions>
        </Modal.Footer>
      </Modal>

      <SeoPreview
        post={seoPost}
        isOpen={!!seoPost}
        onClose={() => setSeoPost(null)}
      />

      <PostForm
        post={formPost}
        isOpen={isFormOpen}
        onClose={() => setFormPost(null)}
        onSaved={refreshPosts}
      />
    </Box>
  );
}

export default Posts;
