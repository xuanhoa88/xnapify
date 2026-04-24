/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';

import {
  EnvelopeClosedIcon,
  TrashIcon,
  EyeOpenIcon,
  Pencil2Icon,
  CopyIcon,
} from '@radix-ui/react-icons';
import { Box, Flex, Text, Button, Badge } from '@radix-ui/themes';
import format from 'date-fns/format';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import { useHistory } from '@shared/renderer/components/History';
import Modal from '@shared/renderer/components/Modal';
import { DataTable } from '@shared/renderer/components/Table';

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

  // Bulk action descriptors
  const moreBulkActions = useMemo(
    () => [
      {
        label: t('admin:emails.list.delete', 'Delete'),
        icon: <TrashIcon width={16} height={16} />,
        variant: 'danger',
        onClick: handleBulkDelete,
      },
    ],
    [t, handleBulkDelete],
  );

  // Column definitions
  const columns = useMemo(
    () => [
      {
        key: 'name',
        dataIndex: 'name',
        title: t('admin:emails.list.name', 'Name'),
        order: 10,
        render: value => <Text weight='bold'>{value}</Text>,
      },
      {
        key: 'slug',
        dataIndex: 'slug',
        title: t('admin:emails.list.slug', 'Slug'),
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
        title: t('admin:emails.list.subject', 'Subject'),
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
        title: t('admin:emails.list.status', 'Status'),
        order: 40,
        render: isActive => (
          <Badge
            color={isActive ? 'green' : 'gray'}
            variant={isActive ? 'soft' : 'surface'}
            radius='full'
          >
            {isActive
              ? t('admin:emails.list.active', 'Active')
              : t('admin:emails.list.inactive', 'Inactive')}
          </Badge>
        ),
      },
      {
        key: 'updated',
        dataIndex: 'updated_at',
        title: t('admin:emails.list.updated', 'Updated'),
        order: 50,
        render: value =>
          value ? format(new Date(value), 'MMM dd, yyyy') : '—',
      },
      {
        key: 'actions',
        title: '',
        order: 9999,
        className: 'text-right',
        render: (_, record) => (
          <Flex gap='1' justify='end'>
            <Button
              variant='ghost'
              size='1'
              title={t('admin:emails.list.preview', 'Preview')}
              onClick={() => handlePreview(record)}
            >
              <EyeOpenIcon width={16} height={16} />
            </Button>
            <Button
              variant='ghost'
              size='1'
              title={t('admin:emails.list.edit', 'Edit')}
              onClick={() =>
                history.push(`/admin/emails/templates/${record.id}/edit`)
              }
            >
              <Pencil2Icon width={16} height={16} />
            </Button>
            <Button
              variant='ghost'
              size='1'
              title={t('admin:emails.list.duplicate', 'Duplicate')}
              onClick={() => handleDuplicate(record)}
            >
              <CopyIcon width={16} height={16} />
            </Button>
            <Button
              variant='ghost'
              size='1'
              title={t('admin:emails.list.delete', 'Delete')}
              onClick={() => handleDelete(record)}
              className={s.deleteBtn}
            >
              <TrashIcon width={16} height={16} />
            </Button>
          </Flex>
        ),
      },
    ],
    [t, history, handlePreview, handleDuplicate, handleDelete],
  );

  return (
    <Box className='p-6 max-w-[1400px] mx-auto'>
      <DataTable
        columns={columns}
        dataSource={templates}
        rowKey='id'
        loading={loading}
        initialized={initialized}
        variant='surface'
        selectable
        selectedKeys={selectedItems}
        onSelectionChange={setSelectedItems}
      >
        <DataTable.Header
          title={t('admin:emails.list.title', 'Templates')}
          subtitle={t(
            'admin:emails.list.subtitle',
            'Manage email templates with LiquidJS',
          )}
          icon={<EnvelopeClosedIcon width={24} height={24} />}
        >
          <Button
            variant='solid'
            color='indigo'
            onClick={() => history.push('/admin/emails/templates/create')}
          >
            {t('admin:emails.list.addTemplate', 'New Template')}
          </Button>
        </DataTable.Header>

        <DataTable.Toolbar>
          <DataTable.Search
            value={search}
            onChange={handleSearchChange}
            placeholder={t(
              'admin:emails.list.searchTemplates',
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
            'admin:emails.list.noTemplatesFound',
            'No email templates found',
          )}
          description={t(
            'admin:emails.list.noTemplatesDescription',
            'Create your first email template to get started.',
          )}
        />
        <DataTable.Error message={error} onRetry={refreshList} />
        <DataTable.Loader />

        <DataTable.Pagination
          current={currentPage}
          totalPages={pagination ? pagination.pages : undefined}
          total={pagination ? pagination.total : undefined}
          onChange={setCurrentPage}
        />
      </DataTable>

      <Modal.ConfirmDelete
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
        <Modal.Body className={s.modalBody}>
          <TemplateEditor className={s.templateEditor} />
        </Modal.Body>
      </Modal>
    </Box>
  );
}

export default EmailTemplates;
