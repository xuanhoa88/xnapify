/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useEffect, useCallback, useState, useMemo } from 'react';

import { Flex, Box, Text, Badge, Grid, Card, Button } from '@radix-ui/themes';
import clsx from 'clsx';
import sortBy from 'lodash/sortBy';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import Form, { useFormContext } from '@shared/renderer/components/Form';
import Icon from '@shared/renderer/components/Icon';
import Loader from '@shared/renderer/components/Loader';
import { PageHeader } from '@shared/renderer/components/PageHeader';
import { useRbac } from '@shared/renderer/components/Rbac';

import { useSettingsTabConfig } from '../hooks/useSettingsTabConfig';
import {
  fetchSettings,
  saveNamespaceSettings,
  selectGroups,
  selectLoading,
  selectError,
  selectInitialized,
} from '../redux';

import s from './SettingsPage.css';

// =============================================================================
// Type-specific input components
// =============================================================================

function SaveButton() {
  const { t } = useTranslation();
  const {
    formState: { isDirty, isSubmitting },
  } = useFormContext();

  return (
    <Button
      type='submit'
      variant='solid'
      color='indigo'
      disabled={!isDirty || isSubmitting}
    >
      <Icon name='DiscIcon' size={16} />
      {isSubmitting
        ? t('admin:common.saving', 'Saving...')
        : t('admin:common.save', 'Save Changes')}
    </Button>
  );
}

function SettingRow({ setting, canWrite }) {
  const { t } = useTranslation();

  const name = setting.key;

  const renderInput = () => {
    switch (setting.type) {
      case 'boolean':
        return <Form.Switch disabled={!canWrite} />;
      case 'integer':
        return <Form.Number disabled={!canWrite} />;
      case 'password':
        return <Form.Password disabled={!canWrite} />;
      case 'json':
        return (
          <Form.Json
            disabled={!canWrite}
            collapsed={1}
            displayObjectSize
            enableClipboard
          />
        );
      default: {
        // Intelligent heuristic for textareas based on setting key naming convention
        const upperKey = setting.key.toUpperCase();
        const isDescriptive =
          upperKey.includes('DESC') ||
          upperKey.includes('MESSAGE') ||
          upperKey.includes('TEXT');
        if (setting.type === 'string' && isDescriptive) {
          return (
            <Box className='[&_textarea]:font-mono [&_textarea]:min-h-[80px]'>
              <Form.Textarea disabled={!canWrite} rows={3} spellCheck={false} />
            </Box>
          );
        }
        return <Form.Input disabled={!canWrite} />;
      }
    }
  };

  const getBadgeColor = type => {
    switch (type) {
      case 'boolean':
        return 'blue';
      case 'integer':
        return 'green';
      case 'json':
        return 'purple';
      case 'password':
        return 'red';
      default:
        return 'gray';
    }
  };

  return (
    <Flex
      direction={
        setting.type === 'boolean' ? 'row' : { initial: 'column', md: 'row' }
      }
      justify={setting.type === 'boolean' ? 'between' : 'start'}
      gap='4'
      align={setting.type === 'boolean' ? 'center' : 'start'}
      className={clsx('p-4 md:p-5', s.settingRow)}
    >
      <Box
        className={clsx(
          'flex-1 min-w-0',
          setting.type === 'boolean' ? 'md:pr-2' : 'md:pr-5',
        )}
      >
        <Flex align='center' gap='2' wrap='wrap' className='mb-2'>
          <Text
            as='code'
            size='2'
            weight='bold'
            className={clsx('py-1 px-2 rounded-md', s.keyText)}
          >
            {setting.key}
          </Text>
          <Badge size='1' color={getBadgeColor(setting.type)}>
            {setting.type}
          </Badge>
          {setting.isPublic && (
            <Badge size='1' color='green' variant='soft'>
              {t('settings:admin.badgePublic', 'public')}
            </Badge>
          )}
          {setting.isDefault && (
            <Badge size='1' color='orange' variant='soft'>
              {t('settings:admin.badgeDefault', 'env default')}
            </Badge>
          )}
        </Flex>
        {setting.description && (
          <Text
            as='p'
            size='2'
            color='gray'
            className={setting.defaultEnvVar ? 'mb-1' : 'mb-0'}
          >
            {setting.description}
          </Text>
        )}
        {setting.defaultEnvVar && (
          <Text as='p' size='1' color='gray'>
            {t('settings:admin.fallback', 'Fallback: ')}
            <Text as='code' className='font-mono'>
              {setting.defaultEnvVar}
            </Text>
          </Text>
        )}
      </Box>
      <Flex
        width={setting.type === 'boolean' ? 'auto' : '100%'}
        maxWidth={{ initial: '100%', md: '400px' }}
        shrink='0'
        justify={setting.type === 'boolean' ? 'end' : 'start'}
      >
        <Box width='100%'>
          <Form.Field name={name} showError={false}>
            {renderInput()}
          </Form.Field>
        </Box>
      </Flex>
    </Flex>
  );
}

SettingRow.propTypes = {
  setting: PropTypes.shape({
    namespace: PropTypes.string.isRequired,
    key: PropTypes.string.isRequired,
    type: PropTypes.string.isRequired,
    description: PropTypes.string,
    defaultEnvVar: PropTypes.string,
    isPublic: PropTypes.bool,
    isDefault: PropTypes.bool,
  }).isRequired,
  canWrite: PropTypes.bool.isRequired,
};

// =============================================================================
// Namespace helpers
// =============================================================================

function getNamespaceLabel(ns, t, labels, translationKeys) {
  const fallback = labels[ns] || ns;

  if (translationKeys[ns]) {
    const extTranslated = t(translationKeys[ns], { defaultValue: '' });
    if (extTranslated) return extTranslated;
  }

  const coreKey = `settings:admin.namespaces.${ns}`;
  return t(coreKey, { defaultValue: fallback });
}

function sortNamespaces(namespaces, order) {
  return sortBy(namespaces, [
    ns => {
      const idx = order.indexOf(ns);
      return idx === -1 ? Infinity : idx;
    },
    ns => ns,
  ]);
}

function sortSettingFields(settings) {
  return sortBy(settings, ['sortOrder', 'key']);
}

// =============================================================================
// Settings Builder Form
// =============================================================================

function SettingsBuilderForm({ namespace, settings, onSaved }) {
  const dispatch = useDispatch();
  const { hasPermission } = useRbac();

  const canWrite = useMemo(() => {
    return (
      hasPermission(`settings.${namespace}:write`) ||
      hasPermission('settings:*') ||
      hasPermission('*:*')
    );
  }, [namespace, hasPermission]);

  const sortedFields = useMemo(() => {
    return sortSettingFields(settings);
  }, [settings]);

  const defaultValues = useMemo(() => {
    const vals = {};
    settings.forEach(item => {
      let val = item.value;
      if (item.type === 'boolean') {
        val = val === 'true' || val === true;
      } else if (item.type === 'integer') {
        val = val != null ? parseInt(val, 10) : null;
      }
      vals[item.key] = val;
    });
    return vals;
  }, [settings]);

  const handleSave = useCallback(
    async (data, methods) => {
      const dirty = methods.formState.dirtyFields;
      if (Object.keys(dirty).length === 0) return;

      const payload = {};
      Object.keys(dirty).forEach(key => {
        let val = data[key];
        if (typeof val === 'number' && Number.isNaN(val)) val = null;
        if (val === '') val = null;
        payload[key] = val;
      });

      if (Object.keys(payload).length > 0) {
        const result = await dispatch(
          saveNamespaceSettings({ namespace, payload }),
        );
        if (!result.error) {
          methods.reset(data);
          dispatch(fetchSettings());
          if (typeof onSaved === 'function') onSaved(namespace);
        }
      }
    },
    [dispatch, namespace, onSaved],
  );

  return (
    <Form defaultValues={defaultValues} onSubmit={handleSave}>
      <Card variant='surface'>
        <Box p='0'>
          {sortedFields.map(setting => (
            <SettingRow
              key={`${setting.namespace}___${setting.key}`}
              setting={setting}
              canWrite={canWrite}
            />
          ))}
        </Box>
        {canWrite && (
          <Flex
            align='center'
            justify='end'
            gap='2'
            px='5'
            py='4'
            className={clsx('rounded-b-md', s.saveContainer)}
          >
            <SaveButton />
          </Flex>
        )}
      </Card>
    </Form>
  );
}

SettingsBuilderForm.propTypes = {
  namespace: PropTypes.string.isRequired,
  settings: PropTypes.array.isRequired,
  onSaved: PropTypes.func,
};

// =============================================================================
// Main component
// =============================================================================

function SettingsPage({ context }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { hasPermission } = useRbac();

  const { icons, labels, translationKeys, order } = useSettingsTabConfig(
    context.container.resolve('extension'),
  );

  const groups = useSelector(selectGroups);
  const loading = useSelector(selectLoading);
  const initialized = useSelector(selectInitialized);
  const error = useSelector(selectError);

  const [activeTab, setActiveTab] = useState(null);

  const rawNamespaces = useMemo(
    () =>
      groups
        ? sortNamespaces(
            Object.keys(groups).filter(ns => order.includes(ns)),
            order,
          )
        : [],
    [groups, order],
  );

  const namespaces = useMemo(() => {
    return rawNamespaces.filter(
      ns =>
        hasPermission(`settings.${ns}:read`) ||
        hasPermission('settings:*') ||
        hasPermission('*:*'),
    );
  }, [rawNamespaces, hasPermission]);

  useEffect(() => {
    dispatch(fetchSettings());
  }, [dispatch]);

  useEffect(() => {
    if (!activeTab && namespaces.length > 0) {
      setActiveTab(namespaces[0]);
    }
  }, [namespaces, activeTab]);

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (!initialized || (loading && namespaces.length === 0)) {
    return (
      <Box className='p-4 md:p-6 max-w-[1400px] mx-auto'>
        <PageHeader
          title={t('settings:admin.title', 'Global Settings')}
          subtitle={t(
            'settings:admin.subtitle',
            'Configure system-wide settings',
          )}
          icon={<Icon name='GearIcon' size={24} />}
        />
        <Loader
          variant='spinner'
          message={t('settings:admin.loading', 'Loading settings...')}
        />
      </Box>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <Box className='p-4 md:p-6 max-w-[1400px] mx-auto'>
        <PageHeader
          title={t('settings:admin.title', 'Global Settings')}
          subtitle={t(
            'settings:admin.subtitle',
            'Configure system-wide settings',
          )}
          icon={<Icon name='GearIcon' size={24} />}
        />
        <Flex
          direction='column'
          align='center'
          justify='center'
          p='6'
          className={clsx('rounded-md', s.errorContainer)}
        >
          <Text color='red' size='4' weight='bold' mb='2'>
            {t('settings:admin.errorLoading', 'Error loading settings')}
          </Text>
          <Text color='red' size='2' mb='4'>
            {error}
          </Text>
          <Button
            variant='soft'
            color='red'
            onClick={() => dispatch(fetchSettings())}
          >
            {t('common:retry', 'Retry')}
          </Button>
        </Flex>
      </Box>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <Box className='p-4 md:p-6 max-w-[1400px] mx-auto'>
      <PageHeader
        title={t('settings:admin.title', 'Global Settings')}
        subtitle={t(
          'settings:admin.subtitle',
          'Configure system-wide settings for all modules',
        )}
        icon={<Icon name='GearIcon' size={24} />}
      />

      <Grid
        columns={{ initial: '1', lg: '250px 1fr' }}
        gap={{ initial: '4', md: '6' }}
        align='start'
      >
        {/* Namespace tabs */}
        <Flex
          as='nav'
          direction={{ initial: 'row', lg: 'column' }}
          gap='1'
          className={clsx('overflow-x-auto pb-2 lg:pb-0', s.hideScrollbar)}
        >
          {namespaces.map(ns => (
            <Box
              as='button'
              key={ns}
              type='button'
              onClick={() => setActiveTab(ns)}
              className={clsx(
                'flex items-center px-3 py-2 rounded-md border-none cursor-pointer transition-colors text-left w-auto lg:w-full shrink-0 hover:bg-gray-a3',
                s.navButton,
              )}
              data-state={activeTab === ns ? 'active' : 'inactive'}
            >
              <Icon
                name={typeof icons[ns] === 'string' ? icons[ns] : 'GearIcon'}
                size={16}
                className='shrink-0'
              />
              <Text
                as='span'
                size='2'
                weight={activeTab === ns ? 'medium' : 'regular'}
                grow='1'
                truncate
                ml='2'
              >
                {getNamespaceLabel(ns, t, labels, translationKeys)}
              </Text>
              <Badge
                size='1'
                color={activeTab === ns ? 'indigo' : 'gray'}
                variant='soft'
              >
                {groups[ns].length}
              </Badge>
            </Box>
          ))}
        </Flex>

        {/* Settings panel — only the active tab is mounted */}
        <Box>
          {activeTab && groups[activeTab] && (
            <SettingsBuilderForm
              key={activeTab}
              namespace={activeTab}
              settings={groups[activeTab]}
            />
          )}
        </Box>
      </Grid>
    </Box>
  );
}

SettingsPage.propTypes = {
  context: PropTypes.shape({
    container: PropTypes.object.isRequired,
  }).isRequired,
};

export default SettingsPage;
