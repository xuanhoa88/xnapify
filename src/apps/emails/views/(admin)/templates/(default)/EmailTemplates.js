/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useEffect, useState, useCallback, useRef } from 'react';

import format from 'date-fns/format';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import * as Box from '@shared/renderer/components/Box';
import Button from '@shared/renderer/components/Button';
import ConfirmModal from '@shared/renderer/components/ConfirmModal';
import { useHistory } from '@shared/renderer/components/History';
import Icon from '@shared/renderer/components/Icon';
import Loader from '@shared/renderer/components/Loader';
import Modal from '@shared/renderer/components/Modal';
import Table from '@shared/renderer/components/Table';
import Tag from '@shared/renderer/components/Tag';

import TemplateEditor from '../../components/TemplateEditor';
import {
  fetchTemplates,
  getTemplates,
  getTemplatePagination,
  isListLoading,
  isListInitialized,
  getListError,
  duplicateTemplate,
  deleteTemplate,
  bulkDeleteTemplates,
  previewTemplate,
  clearPreview,
} from '../../redux';

import s from './EmailTemplates.css';

function EmailTemplates() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const history = useHistory();

  const templates = useSelector(getTemplates);
  const pagination = useSelector(getTemplatePagination);
  const loading = useSelector(isListLoading);
  const initialized = useSelector(isListInitialized);
  const error = useSelector(getListError);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedItems, setSelectedItems] = useState([]);

  const [previewOpen, setPreviewOpen] = useState(false);
  const confirmDeleteRef = useRef();

  useEffect(() => {
    dispatch(
      fetchTemplates({
        page: currentPage,
        search,
        status: statusFilter,
      }),
    );
  }, [dispatch, currentPage, search, statusFilter]);

  const refreshList = useCallback(() => {
    dispatch(
      fetchTemplates({
        page: currentPage,
        search,
        status: statusFilter,
      }),
    );
    setSelectedItems([]);
  }, [dispatch, currentPage, search, statusFilter]);

  const handleSearchChange = useCallback(value => {
    setSearch(value);
    setCurrentPage(1);
  }, []);

  const handleClearAllFilters = useCallback(() => {
    setSearch('');
    setStatusFilter('');
    setCurrentPage(1);
  }, []);

  const handleDelete = useCallback(templateItem => {
    if (confirmDeleteRef.current) {
      confirmDeleteRef.current.open({
        ids: [templateItem.id],
        items: [templateItem],
      });
    }
  }, []);

  const handleBulkDelete = useCallback(() => {
    if (confirmDeleteRef.current) {
      confirmDeleteRef.current.open({
        ids: selectedItems,
      });
    }
  }, [selectedItems]);

  const onConfirmDelete = useCallback(
    async data => {
      try {
        if (data.ids.length === 1) {
          await dispatch(deleteTemplate(data.ids[0])).unwrap();
        } else {
          await dispatch(bulkDeleteTemplates(data.ids)).unwrap();
        }
        return { success: true };
      } catch (err) {
        return {
          success: false,
          error:
            err.message ||
            t(
              'admin:emails.deleteModal.error',
              'Failed to delete template(s). Please try again.',
            ),
        };
      }
    },
    [dispatch, t],
  );

  const getDeleteItemName = useCallback(
    data => {
      if (!data) return '';
      if (data.items && data.items.length === 1) {
        return data.items[0].name;
      }
      return t('admin:emails.deleteModal.bulkCount', '{{count}} templates', {
        count: data.ids.length,
      });
    },
    [t],
  );

  const handleDuplicate = useCallback(
    templateItem => {
      dispatch(duplicateTemplate(templateItem.id));
    },
    [dispatch],
  );

  const handlePreview = useCallback(
    record => {
      dispatch(
        previewTemplate({
          id: record.id,
          sampleData: record.sample_data || {},
        }),
      );
      setPreviewOpen(true);
    },
    [dispatch],
  );

  const handlePreviewClose = useCallback(() => {
    setPreviewOpen(false);
    dispatch(clearPreview());
  }, [dispatch]);

  const hasActiveFilters = search || statusFilter;

  // Loading state (first load)
  if (!initialized || (loading && templates.length === 0)) {
    return (
      <div className={s.root}>
        <Box.Header
          icon={<Icon name='mail' size={24} />}
          title={t('admin:emails.list.title', 'Templates')}
          subtitle={t(
            'admin:emails.list.subtitle',
            'Manage email templates with LiquidJS',
          )}
        />
        <Loader
          variant='skeleton'
          message={t('admin:emails.list.loading', 'Loading email templates...')}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className={s.root}>
        <Box.Header
          icon={<Icon name='mail' size={24} />}
          title={t('admin:emails.list.title', 'Templates')}
          subtitle={t(
            'admin:emails.list.subtitle',
            'Manage email templates with LiquidJS',
          )}
        />
        <Table.Error
          title={t(
            'admin:emails.errors.loadTemplates',
            'Error loading templates',
          )}
          error={error}
          onRetry={refreshList}
        />
      </div>
    );
  }

  return (
    <div className={s.root}>
      <Box.Header
        icon={<Icon name='mail' size={24} />}
        title={t('admin:emails.list.title', 'Templates')}
        subtitle={t(
          'admin:emails.list.subtitle',
          'Manage email templates with LiquidJS',
        )}
      >
        <Button
          variant='primary'
          onClick={() => history.push('/admin/emails/templates/create')}
        >
          {t('admin:emails.list.addTemplate', 'New Template')}
        </Button>
      </Box.Header>

      {selectedItems.length > 0 && (
        <Table.BulkActionsBar
          count={selectedItems.length}
          actions={[]}
          moreActions={[
            {
              label: t('admin:emails.list.delete', 'Delete'),
              icon: <Icon name='trash' size={16} />,
              variant: 'danger',
              onClick: handleBulkDelete,
            },
          ]}
          onClear={() => setSelectedItems([])}
        />
      )}

      <Table.SearchBar
        className={s.filters}
        value={search}
        onChange={handleSearchChange}
        placeholder={t(
          'admin:emails.list.searchTemplates',
          'Search templates...',
        )}
      >
        <div className={s.filterActions}>
          {hasActiveFilters && (
            <Button
              variant='ghost'
              size='small'
              onClick={handleClearAllFilters}
              type='button'
              title={t(
                'admin:emails.list.resetAllFilters',
                'Reset all filters',
              )}
            >
              <Icon name='x' size={12} />
              {t('admin:emails.list.clearFilters', 'Clear Filters')}
            </Button>
          )}
        </div>
      </Table.SearchBar>

      <Table
        rowSelection={{
          selectedRowKeys: selectedItems,
          onChange: keys => setSelectedItems(keys),
        }}
        columns={[
          {
            title: t('admin:emails.list.name', 'Name'),
            dataIndex: 'name',
            render: name => (
              <div className={s.nameCell}>
                <strong>{name}</strong>
              </div>
            ),
          },
          {
            title: t('admin:emails.list.slug', 'Slug'),
            dataIndex: 'slug',
            render: slug => <code className={s.slug}>{slug}</code>,
          },
          {
            title: t('admin:emails.list.subject', 'Subject'),
            dataIndex: 'subject',
            render: subject => (
              <span className={s.subject}>{subject || '—'}</span>
            ),
          },
          {
            title: t('admin:emails.list.status', 'Status'),
            key: 'status',
            render: (_, record) => (
              <Tag variant={record.is_active ? 'success' : 'default'}>
                {record.is_active
                  ? t('admin:emails.list.active', 'Active')
                  : t('admin:emails.list.inactive', 'Inactive')}
              </Tag>
            ),
          },
          {
            title: t('admin:emails.list.updated', 'Updated'),
            dataIndex: 'updated_at',
            render: date =>
              date ? format(new Date(date), 'MMM dd, yyyy') : '—',
          },
          {
            key: 'actions',
            render: (_, record) => (
              <div className={s.actions}>
                <Button
                  variant='ghost'
                  size='small'
                  iconOnly
                  title={t('admin:emails.list.preview', 'Preview')}
                  onClick={() => handlePreview(record)}
                >
                  <Icon name='eye' size={16} />
                </Button>
                <Button
                  variant='ghost'
                  size='small'
                  iconOnly
                  title={t('admin:emails.list.edit', 'Edit')}
                  onClick={() =>
                    history.push(`/admin/emails/templates/${record.id}/edit`)
                  }
                >
                  <Icon name='edit' size={16} />
                </Button>
                <Button
                  variant='ghost'
                  size='small'
                  iconOnly
                  title={t('admin:emails.list.duplicate', 'Duplicate')}
                  onClick={() => handleDuplicate(record)}
                >
                  <Icon name='copy' size={16} />
                </Button>
                <Button
                  variant='ghost'
                  size='small'
                  iconOnly
                  title={t('admin:emails.list.delete', 'Delete')}
                  onClick={() => handleDelete(record)}
                >
                  <Icon name='trash' size={16} />
                </Button>
              </div>
            ),
          },
        ]}
        dataSource={templates}
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
              icon='mail'
              title={t(
                'admin:emails.list.noTemplatesFound',
                'No email templates found',
              )}
              description={t(
                'admin:emails.list.noTemplatesDescription',
                'Create your first email template to get started.',
              )}
            >
              <Button
                variant='primary'
                onClick={() => history.push('/admin/emails/templates/create')}
              >
                {t('admin:emails.list.addTemplate', 'New Template')}
              </Button>
            </Table.Empty>
          ),
        }}
      />

      <ConfirmModal.Delete
        ref={confirmDeleteRef}
        title={t('admin:emails.deleteModal.title', 'Delete Template')}
        getItemName={getDeleteItemName}
        onDelete={onConfirmDelete}
        onSuccess={refreshList}
      />

      <Modal
        isOpen={previewOpen}
        onClose={handlePreviewClose}
        placement='right'
      >
        <Modal.Header onClose={handlePreviewClose}>
          {t('admin:emails.list.previewTitle', 'Template Preview')}
        </Modal.Header>
        <Modal.Body className={s.previewBody}>
          <TemplateEditor />
        </Modal.Body>
      </Modal>
    </div>
  );
}

export default EmailTemplates;
