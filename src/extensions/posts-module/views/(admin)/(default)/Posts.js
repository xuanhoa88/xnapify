/**
 * Posts admin listing page
 */
import { useEffect, useState, useCallback, useRef } from 'react';

import format from 'date-fns/format';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import * as Box from '@shared/renderer/components/Box';
import Button from '@shared/renderer/components/Button';
import Icon from '@shared/renderer/components/Icon';
import Loader from '@shared/renderer/components/Loader';
import Modal from '@shared/renderer/components/Modal';
import { useRbac } from '@shared/renderer/components/Rbac';
import Table from '@shared/renderer/components/Table';
import Tag from '@shared/renderer/components/Tag';

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

  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const deleteModalRef = useRef();
  const [seoPost, setSeoPost] = useState(null);

  useEffect(() => {
    dispatch(
      fetchPosts({
        page: currentPage,
        status: statusFilter,
      }),
    );
  }, [dispatch, currentPage, statusFilter]);

  const refreshPosts = useCallback(() => {
    dispatch(
      fetchPosts({
        page: currentPage,
        status: statusFilter,
      }),
    );
  }, [dispatch, currentPage, statusFilter]);

  const handleStatusFilterChange = useCallback(value => {
    setStatusFilter(value);
    setCurrentPage(1);
  }, []);

  const handleDelete = useCallback(post => {
    if (deleteModalRef.current) {
      deleteModalRef.current.open(post);
    }
  }, []);

  const handleConfirmDelete = useCallback(
    async post => {
      await dispatch(deletePost(post.id)).unwrap();
      refreshPosts();
    },
    [dispatch, refreshPosts],
  );

  // Loading state — first fetch or loading with no data
  if (!initialized || (loading && posts.length === 0)) {
    return (
      <div className={s.root}>
        <Box.Header
          icon={<Icon name='book-open' size={24} />}
          title={t('posts:title', 'Posts')}
          subtitle={t('posts:subtitle', 'Manage content')}
        />
        <Loader
          variant='skeleton'
          message={t('posts:loading', 'Loading posts...')}
        />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={s.root}>
        <Box.Header
          icon={<Icon name='book-open' size={24} />}
          title={t('posts:title', 'Posts')}
          subtitle={t('posts:subtitle', 'Manage content')}
        />
        <Table.Error
          title={t('posts:errors.load', 'Error loading posts')}
          error={error}
          onRetry={refreshPosts}
        />
      </div>
    );
  }

  return (
    <div className={s.root}>
      <Box.Header
        icon={<Icon name='book-open' size={24} />}
        title={t('posts:title', 'Posts')}
        subtitle={t('posts:subtitle', 'Manage content')}
      >
        <Button
          variant='primary'
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
      </Box.Header>

      <Table.SearchBar
        placeholder={t('posts:search', 'Search posts...')}
        value=''
        onChange={() => {}}
      >
        <select
          className={s.statusFilter}
          value={statusFilter}
          onChange={e => handleStatusFilterChange(e.target.value)}
        >
          <option value=''>{t('posts:filter.allStatus', 'All Status')}</option>
          <option value='draft'>{t('posts:filter.draft', 'Draft')}</option>
          <option value='published'>
            {t('posts:filter.published', 'Published')}
          </option>
          <option value='archived'>
            {t('posts:filter.archived', 'Archived')}
          </option>
        </select>
      </Table.SearchBar>

      <Table
        columns={[
          {
            title: t('posts:table.title', 'Title'),
            key: 'title',
            render: (_, post) => (
              <div>
                <strong>{post.title}</strong>
                {post.excerpt && (
                  <div className={s.excerpt}>{post.excerpt}</div>
                )}
              </div>
            ),
          },
          {
            title: t('posts:table.status', 'Status'),
            key: 'status',
            render: (_, post) => {
              const variants = {
                draft: 'default',
                published: 'success',
                archived: 'warning',
              };
              return (
                <Tag variant={variants[post.status] || 'default'}>
                  {post.status}
                </Tag>
              );
            },
          },
          {
            title: t('posts:table.date', 'Date'),
            dataIndex: 'created_at',
            render: date =>
              date ? format(new Date(date), 'MMM dd, yyyy') : '—',
          },
          {
            key: 'actions',
            render: (_, post) => (
              <div className={s.actions}>
                <Button
                  variant='ghost'
                  size='small'
                  iconOnly
                  title={t('posts:seoPreview', 'SEO Preview')}
                  onClick={() => setSeoPost(post)}
                >
                  <Icon name='search' size={16} />
                </Button>
                <Button
                  variant='ghost'
                  size='small'
                  iconOnly
                  {...(!canUpdate && {
                    disabled: true,
                    title: t(
                      'posts:noPermissionToUpdate',
                      'You do not have permission to edit posts',
                    ),
                  })}
                  {...(canUpdate && {
                    title: t('posts:edit', 'Edit'),
                  })}
                >
                  <Icon name='edit' size={16} />
                </Button>
                <Button
                  variant='ghost'
                  size='small'
                  iconOnly
                  {...(!canDelete && {
                    disabled: true,
                    title: t(
                      'posts:noPermissionToDelete',
                      'You do not have permission to delete posts',
                    ),
                  })}
                  {...(canDelete && {
                    title: t('posts:delete', 'Delete'),
                  })}
                  onClick={() => handleDelete(post)}
                >
                  <Icon name='trash' size={16} />
                </Button>
              </div>
            ),
          },
        ]}
        dataSource={posts}
        rowKey='id'
        loading={loading}
        pagination={
          pagination && pagination.pages > 1
            ? {
                current: currentPage,
                pages: pagination.pages,
                total: pagination.total,
                onChange: setCurrentPage,
              }
            : false
        }
        locale={{
          emptyText: (
            <Table.Empty
              icon='book-open'
              title={t('posts:empty.title', 'No posts yet')}
              description={t(
                'posts:empty.description',
                'Create your first post to get started.',
              )}
            >
              <Button
                variant='primary'
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
            </Table.Empty>
          ),
        }}
      />

      <Modal.Confirm
        ref={deleteModalRef}
        title={t('posts:deleteConfirm.title', 'Delete Post')}
        message={t(
          'posts:deleteConfirm.message',
          'Are you sure you want to delete this post? This action cannot be undone.',
        )}
        confirmLabel={t('posts:deleteConfirm.confirm', 'Delete')}
        variant='danger'
        loading={deleting}
        onConfirm={handleConfirmDelete}
      />

      <SeoPreview
        post={seoPost}
        isOpen={!!seoPost}
        onClose={() => setSeoPost(null)}
      />
    </div>
  );
}

export default Posts;
