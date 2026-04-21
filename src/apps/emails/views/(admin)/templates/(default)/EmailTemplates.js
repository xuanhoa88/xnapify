/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useEffect, useState, useCallback, useRef } from 'react';

import {
  EnvelopeClosedIcon,
  TrashIcon,
  Cross2Icon,
  EyeOpenIcon,
  Pencil2Icon,
  CopyIcon,
} from '@radix-ui/react-icons';
import {
  Box,
  Flex,
  Heading,
  Text,
  Table,
  Checkbox,
  Button,
  Badge,
} from '@radix-ui/themes';
import clsx from 'clsx';
import format from 'date-fns/format';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import { useHistory } from '@shared/renderer/components/History';
import Loader from '@shared/renderer/components/Loader';
import Modal from '@shared/renderer/components/Modal';
import {
  TablePagination,
  TableSearch,
  TableBulkActions,
} from '@shared/renderer/components/Table';

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
 * EmailTemplates layout natively omitting explicit internal class logic reliably elegantly neatly consistently purely functionally completely simply perfectly accurately dependably.
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

  const handleSelectAll = checked => {
    if (checked) {
      setSelectedItems(templates.map(t => t.id));
    } else {
      setSelectedItems([]);
    }
  };

  const handleSelectRow = (id, checked) => {
    if (checked) {
      setSelectedItems(prev => [...prev, id]);
    } else {
      setSelectedItems(prev => prev.filter(k => k !== id));
    }
  };

  const isAllSelected =
    templates.length > 0 && selectedItems.length === templates.length;
  const hasActiveFilters = search || statusFilter;

  // Loading state (first load)
  if (!initialized || (loading && templates.length === 0)) {
    return (
      <Box className={s.containerBox}>
        <Flex
          align='center'
          justify='between'
          wrap='wrap'
          gap='4'
          pb='4'
          mb='6'
          className={s.adminHeader}
        >
          <Flex align='center' gap='3'>
            <Flex align='center' justify='center' className={s.adminHeaderIcon}>
              <EnvelopeClosedIcon width={24} height={24} />
            </Flex>
            <Flex direction='column'>
              <Heading size='6'>
                {t('admin:emails.list.title', 'Templates')}
              </Heading>
              <Text size='2' color='gray' mt='1'>
                {t(
                  'admin:emails.list.subtitle',
                  'Manage email templates with LiquidJS',
                )}
              </Text>
            </Flex>
          </Flex>
        </Flex>
        <Loader
          variant='skeleton'
          message={t('admin:emails.list.loading', 'Loading email templates...')}
        />
      </Box>
    );
  }

  if (error) {
    return (
      <Box className={s.containerBox}>
        <Flex
          align='center'
          justify='between'
          wrap='wrap'
          gap='4'
          pb='4'
          mb='6'
          className={s.adminHeader}
        >
          <Flex align='center' gap='3'>
            <Flex align='center' justify='center' className={s.adminHeaderIcon}>
              <EnvelopeClosedIcon width={24} height={24} />
            </Flex>
            <Flex direction='column'>
              <Heading size='6'>
                {t('admin:emails.list.title', 'Templates')}
              </Heading>
              <Text size='2' color='gray' mt='1'>
                {t(
                  'admin:emails.list.subtitle',
                  'Manage email templates with LiquidJS',
                )}
              </Text>
            </Flex>
          </Flex>
        </Flex>
        <Flex
          direction='column'
          align='center'
          justify='center'
          p='6'
          className={s.adminErrorBlock}
        >
          <Text color='red' size='4' weight='bold' mb='2'>
            {t('admin:emails.errors.loadTemplates', 'Error loading templates')}
          </Text>
          <Text color='red' size='2' mb='4'>
            {error}
          </Text>
          <Button variant='soft' color='red' onClick={refreshList} size='2'>
            {t('common:retry', 'Retry')}
          </Button>
        </Flex>
      </Box>
    );
  }

  return (
    <Box className={s.containerBox}>
      <Flex
        align='center'
        justify='between'
        wrap='wrap'
        gap='4'
        pb='4'
        mb='6'
        className={s.adminHeader}
      >
        <Flex align='center' gap='3'>
          <Flex align='center' justify='center' className={s.adminHeaderIcon}>
            <EnvelopeClosedIcon width={24} height={24} />
          </Flex>
          <Flex direction='column'>
            <Heading size='6'>
              {t('admin:emails.list.title', 'Templates')}
            </Heading>
            <Text size='2' color='gray' mt='1'>
              {t(
                'admin:emails.list.subtitle',
                'Manage email templates with LiquidJS',
              )}
            </Text>
          </Flex>
        </Flex>
        <Flex align='center' gap='3'>
          <Button
            variant='solid'
            color='indigo'
            onClick={() => history.push('/admin/emails/templates/create')}
          >
            {t('admin:emails.list.addTemplate', 'New Template')}
          </Button>
        </Flex>
      </Flex>

      <Box className={s.surfaceBox}>
        {selectedItems.length > 0 && (
          <TableBulkActions
            count={selectedItems.length}
            actions={[]}
            moreActions={[
              {
                label: t('admin:emails.list.delete', 'Delete'),
                icon: <TrashIcon width={16} height={16} />,
                variant: 'danger',
                onClick: handleBulkDelete,
              },
            ]}
            onClear={() => setSelectedItems([])}
          />
        )}

        <Box className={s.tableSearchBox}>
          <TableSearch
            value={search}
            onChange={handleSearchChange}
            placeholder={t(
              'admin:emails.list.searchTemplates',
              'Search templates...',
            )}
          >
            <Flex gap='2'>
              {hasActiveFilters && (
                <Button
                  variant='ghost'
                  size='1'
                  onClick={handleClearAllFilters}
                  type='button'
                  title={t(
                    'admin:emails.list.resetAllFilters',
                    'Reset all filters',
                  )}
                >
                  <Cross2Icon width={12} height={12} />
                  {t('admin:emails.list.clearFilters', 'Clear Filters')}
                </Button>
              )}
            </Flex>
          </TableSearch>
        </Box>

        <Box className={s.tableWrapper}>
          <Table.Root variant='surface'>
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell className={s.checkboxCol}>
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={handleSelectAll}
                  />
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>
                  {t('admin:emails.list.name', 'Name')}
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>
                  {t('admin:emails.list.slug', 'Slug')}
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>
                  {t('admin:emails.list.subject', 'Subject')}
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>
                  {t('admin:emails.list.status', 'Status')}
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>
                  {t('admin:emails.list.updated', 'Updated')}
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell
                  className={s.textRight}
                ></Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {templates.length === 0 ? (
                <Table.Row>
                  <Table.Cell colSpan={7}>
                    <Flex
                      justify='center'
                      align='center'
                      direction='column'
                      py='9'
                      className={s.adminEmptyBlock}
                    >
                      <EnvelopeClosedIcon
                        width={48}
                        height={48}
                        className={s.adminEmptyIcon}
                      />

                      <Text size='3' weight='bold' mb='1'>
                        {t(
                          'admin:emails.list.noTemplatesFound',
                          'No email templates found',
                        )}
                      </Text>
                      <Text size='2' color='gray' mb='4'>
                        {t(
                          'admin:emails.list.noTemplatesDescription',
                          'Create your first email template to get started.',
                        )}
                      </Text>
                      <Button
                        variant='solid'
                        color='indigo'
                        onClick={() =>
                          history.push('/admin/emails/templates/create')
                        }
                      >
                        {t('admin:emails.list.addTemplate', 'New Template')}
                      </Button>
                    </Flex>
                  </Table.Cell>
                </Table.Row>
              ) : (
                templates.map(template => {
                  const isSelected = selectedItems.includes(template.id);
                  return (
                    <Table.Row
                      key={template.id}
                      className={clsx({ [s.activeRowSelected]: isSelected })}
                    >
                      <Table.Cell className={s.checkboxCol}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={c => handleSelectRow(template.id, c)}
                        />
                      </Table.Cell>
                      <Table.Cell>
                        <Text weight='bold'>{template.name}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text as='code' className={s.slugText}>
                          {template.slug}
                        </Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text color='gray' className={s.subjectText}>
                          {template.subject || '—'}
                        </Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Badge
                          color={template.is_active ? 'green' : 'gray'}
                          variant={template.is_active ? 'soft' : 'surface'}
                          radius='full'
                        >
                          {template.is_active
                            ? t('admin:emails.list.active', 'Active')
                            : t('admin:emails.list.inactive', 'Inactive')}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell>
                        {template.updated_at
                          ? format(
                              new Date(template.updated_at),
                              'MMM dd, yyyy',
                            )
                          : '—'}
                      </Table.Cell>
                      <Table.Cell className={s.textRight}>
                        <Flex gap='1' justify='end'>
                          <Button
                            variant='ghost'
                            size='1'
                            title={t('admin:emails.list.preview', 'Preview')}
                            onClick={() => handlePreview(template)}
                          >
                            <EyeOpenIcon width={16} height={16} />
                          </Button>
                          <Button
                            variant='ghost'
                            size='1'
                            title={t('admin:emails.list.edit', 'Edit')}
                            onClick={() =>
                              history.push(
                                `/admin/emails/templates/${template.id}/edit`,
                              )
                            }
                          >
                            <Pencil2Icon width={16} height={16} />
                          </Button>
                          <Button
                            variant='ghost'
                            size='1'
                            title={t(
                              'admin:emails.list.duplicate',
                              'Duplicate',
                            )}
                            onClick={() => handleDuplicate(template)}
                          >
                            <CopyIcon width={16} height={16} />
                          </Button>
                          <Button
                            variant='ghost'
                            size='1'
                            title={t('admin:emails.list.delete', 'Delete')}
                            onClick={() => handleDelete(template)}
                            className={s.deleteBtn}
                          >
                            <TrashIcon width={16} height={16} />
                          </Button>
                        </Flex>
                      </Table.Cell>
                    </Table.Row>
                  );
                })
              )}
            </Table.Body>
          </Table.Root>
          {loading && templates.length > 0 && (
            <Box className={s.loadingOverlay}>
              <Loader variant='spinner' />
            </Box>
          )}
        </Box>

        {pagination && pagination.pages > 1 && (
          <Box p='4' className={s.paginationBox}>
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
