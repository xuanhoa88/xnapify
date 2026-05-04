/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';

import {
  EnvelopeClosedIcon,
  PlusIcon,
  Pencil2Icon,
  TrashIcon,
} from '@radix-ui/react-icons';
import { Box, Flex, Text, Button, Badge, IconButton } from '@radix-ui/themes';
import format from 'date-fns/format';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import { useHistory } from '@shared/renderer/components/History';
import Modal from '@shared/renderer/components/Modal';
import { DataTable, useTableColumns } from '@shared/renderer/components/Table';

import TemplateActionsDropdown from '../../components/TemplateActionsDropdown';
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

/** Extension hook ID for injecting extra columns into the email templates table. */
const COLUMNS_HOOK_ID = 'table.columns.emails.templates';

/**
 * EmailTemplates — Admin page for managing email templates.
 */
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
  const [pageSize, setPageSize] = useState(10);
  const [selectedItems, setSelectedItems] = useState([]);

  // Selection
  const clearSelection = useCallback(() => setSelectedItems([]), []);

  const [previewOpen, setPreviewOpen] = useState(false);
  const confirmDeleteRef = useRef();

  useEffect(() => {
    dispatch(
      fetchTemplates({
        page: currentPage,
        limit: pageSize,
        search,
        status: statusFilter,
      }),
    );
  }, [dispatch, currentPage, pageSize, search, statusFilter]);

  const refreshList = useCallback(() => {
    dispatch(
      fetchTemplates({
        page: currentPage,
        limit: pageSize,
        search,
        status: statusFilter,
      }),
    );
  }, [dispatch, currentPage, pageSize, search, statusFilter]);

  const handleRefreshList = useCallback(() => {
    clearSelection();
    refreshList();
  }, [clearSelection, refreshList]);

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
              'emails:admin.deleteModal.error',
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
      return t('emails:admin.deleteModal.bulkCount', '{{count}} templates', {
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

  // Bulk action descriptors
  const moreBulkActions = useMemo(
    () => [
      {
        label: t('emails:admin.list.delete', 'Delete'),
        icon: <TrashIcon width={16} height={16} />,
        variant: 'danger',
        onClick: handleBulkDelete,
      },
    ],
    [t, handleBulkDelete],
  );

  // Column definitions
  const baseColumns = useMemo(
    () => [
      {
        key: 'name',
        dataIndex: 'name',
        title: t('emails:admin.list.name', 'Name'),
        order: 10,
        render: value => <Text weight='bold'>{value}</Text>,
      },
      {
        key: 'slug',
        dataIndex: 'slug',
        title: t('emails:admin.list.slug', 'Slug'),
        order: 20,
        render: value => (
          <Text as='code' className={s.slugText}>
            {value}
          </Text>
        ),
      },
      {
        key: 'subject',
        dataIndex: 'subject',
        title: t('emails:admin.list.subject', 'Subject'),
        order: 30,
        render: value => (
          <Text color='gray' className={s.subjectText}>
            {value || '—'}
          </Text>
        ),
      },
      {
        key: 'status',
        dataIndex: 'is_active',
        title: t('emails:admin.list.status', 'Status'),
        order: 40,
        render: isActive => (
          <Badge
            variant={isActive ? 'success' : 'error'}
            color='gray'
            radius='full'
          >
            {isActive
              ? t('emails:admin.list.active', 'Active')
              : t('emails:admin.list.inactive', 'Inactive')}
          </Badge>
        ),
      },
      {
        key: 'updated',
        dataIndex: 'updated_at',
        title: t('emails:admin.list.updated', 'Updated'),
        order: 50,
        render: value => (
          <Text size='2' color='gray'>
            {value ? format(new Date(value), 'MMM dd, yyyy') : '—'}
          </Text>
        ),
      },
      {
        key: 'actions',
        title: '',
        order: 9999,
        className: 'text-right',
        render: (_, record) => (
          <Flex gap='2' justify='end' onClick={e => e.stopPropagation()}>
            <IconButton
              variant='ghost'
              size='2'
              title={t('emails:admin.list.edit', 'Edit')}
              onClick={() =>
                history.push(`/admin/emails/templates/${record.id}/edit`)
              }
            >
              <Pencil2Icon width={16} height={16} />
            </IconButton>
            <IconButton
              variant='ghost'
              size='2'
              title={t('emails:admin.list.delete', 'Delete')}
              onClick={() => handleDelete(record)}
            >
              <TrashIcon width={16} height={16} />
            </IconButton>
            <TemplateActionsDropdown
              template={record}
              onPreview={handlePreview}
              onDuplicate={handleDuplicate}
            />
          </Flex>
        ),
      },
    ],
    [t, history, handlePreview, handleDuplicate, handleDelete],
  );

  // Merge base columns with extension-injected columns
  const { columns } = useTableColumns(COLUMNS_HOOK_ID, baseColumns);

  return (
    <Box className='p-6 max-w-[1400px] mx-auto'>
      <DataTable
        columns={columns}
        dataSource={templates}
        rowKey='id'
        loading={loading}
        initialized={initialized}
        selectable
        selectedKeys={selectedItems}
        onSelectionChange={setSelectedItems}
      >
        <DataTable.Header
          title={t('emails:admin.list.title', 'Templates')}
          subtitle={t(
            'emails:admin.list.subtitle',
            'Manage email templates with LiquidJS',
          )}
          icon={<EnvelopeClosedIcon width={24} height={24} />}
        >
          <Button
            variant='solid'
            color='indigo'
            onClick={() => history.push('/admin/emails/templates/create')}
          >
            <PlusIcon width={16} height={16} />
            {t('emails:admin.list.addTemplate', 'New Template')}
          </Button>
        </DataTable.Header>

        <DataTable.Toolbar>
          <DataTable.Search
            value={search}
            onChange={handleSearchChange}
            placeholder={t(
              'emails:admin.list.searchTemplates',
              'Search templates...',
            )}
          />
          <DataTable.ClearFilters
            visible={!!hasActiveFilters}
            onClick={handleClearAllFilters}
          />
        </DataTable.Toolbar>

        <DataTable.BulkActions actions={[]} moreActions={moreBulkActions} />

        <DataTable.Empty
          icon={<EnvelopeClosedIcon width={48} height={48} />}
          title={t(
            'emails:admin.list.noTemplatesFound',
            'No email templates found',
          )}
          description={t(
            'emails:admin.list.noTemplatesDescription',
            'Create your first email template to get started.',
          )}
        />
        <DataTable.Error message={error} onRetry={handleRefreshList} />
        <DataTable.Loader />

        <DataTable.Pagination
          current={currentPage}
          totalPages={pagination ? pagination.pages : undefined}
          total={pagination ? pagination.total : undefined}
          pageSize={pageSize}
          pageSizeOptions={[10, 20, 50, 100]}
          onChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      </DataTable>

      <Modal.ConfirmDelete
        ref={confirmDeleteRef}
        title={t('emails:admin.deleteModal.title', 'Delete Template')}
        getItemName={getDeleteItemName}
        onDelete={onConfirmDelete}
        onSuccess={handleRefreshList}
      />

      <Modal
        isOpen={previewOpen}
        onClose={handlePreviewClose}
        placement='right'
        width='100%'
        maxWidth={{ initial: '100%', md: '800px' }}
      >
        <Modal.Header onClose={handlePreviewClose}>
          {t('emails:admin.list.previewTitle', 'Template Preview')}
        </Modal.Header>
        <Modal.Body className={s.modalBody}>
          <TemplateEditor className={s.templateEditor} />
        </Modal.Body>
      </Modal>
    </Box>
  );
}

EmailTemplates.propTypes = {
  context: PropTypes.shape({
    container: PropTypes.object.isRequired,
  }),
};

export default EmailTemplates;
