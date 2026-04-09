/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useEffect, useCallback, useState, useMemo } from 'react';

import clsx from 'clsx';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import * as Box from '@shared/renderer/components/Box';
import Button from '@shared/renderer/components/Button';
import Card from '@shared/renderer/components/Card';
import Form, { useFormContext } from '@shared/renderer/components/Form';
import Icon from '@shared/renderer/components/Icon';
import Loader from '@shared/renderer/components/Loader';
import { useRbac } from '@shared/renderer/components/Rbac';
import Table from '@shared/renderer/components/Table';

import {
  fetchSettings,
  saveNamespaceSettings,
  selectGroups,
  selectLoading,
  selectError,
  selectInitialized,
} from '../redux';

// eslint-disable-next-line css-modules/no-unused-class
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
    <Button type='submit' variant='primary' disabled={!isDirty || isSubmitting}>
      <Icon name='save' size={16} />
      {isSubmitting
        ? t('admin:common.saving', 'Saving...')
        : t('admin:common.save', 'Save Changes')}
    </Button>
  );
}

function SettingRow({ setting, canWrite }) {
  const { t } = useTranslation();
  const { setValue, watch } = useFormContext();

  const name = setting.key;
  const currentValue = watch(name);

  // Consider null, empty string, or NaN as "falling back to default env var"
  const isOverridden =
    currentValue !== null &&
    currentValue !== '' &&
    !(typeof currentValue === 'number' && Number.isNaN(currentValue));

  const handleReset = useCallback(() => {
    setValue(name, null, { shouldDirty: true, shouldValidate: true });
  }, [name, setValue]);

  const renderInput = () => {
    // Intelligent heuristic for textareas based on setting key naming convention
    const upperKey = setting.key.toUpperCase();
    const isDescriptive =
      upperKey.includes('DESC') ||
      upperKey.includes('MESSAGE') ||
      upperKey.includes('TEXT');

    if (setting.type === 'string' && isDescriptive) {
      return (
        <Form.Textarea
          disabled={!canWrite}
          rows={3}
          spellCheck={false}
          className={s.textarea}
        />
      );
    }

    switch (setting.type) {
      case 'boolean':
        return <Form.Switch disabled={!canWrite} />;
      case 'integer':
        return <Form.Number disabled={!canWrite} />;
      case 'password':
        return <Form.Password disabled={!canWrite} />;
      case 'json':
        return (
          <Form.Textarea
            disabled={!canWrite}
            rows={4}
            spellCheck={false}
            className={s.textarea}
          />
        );
      default:
        return <Form.Input disabled={!canWrite} />;
    }
  };

  return (
    <div key={name} className={s.settingRow}>
      <div className={s.settingMeta}>
        <div className={s.settingKeyRow}>
          <code className={s.settingKey}>{setting.key}</code>
          <span className={`${s.badge} ${s[`badge-${setting.type}`]}`}>
            {setting.type}
          </span>
          {setting.isPublic && (
            <span className={`${s.badge} ${s.badgePublic}`}>
              {t('admin:settings.badgePublic', 'public')}
            </span>
          )}
          {setting.isDefault && (
            <span className={`${s.badge} ${s.badgeDefault}`}>
              {t('admin:settings.badgeDefault', 'env default')}
            </span>
          )}
        </div>
        {setting.description && (
          <p className={s.settingDesc}>{setting.description}</p>
        )}
        {setting.defaultEnvVar && (
          <p className={s.settingEnvHint}>
            {t('admin:settings.fallback', 'Fallback: ')}
            <code>{setting.defaultEnvVar}</code>
          </p>
        )}
      </div>
      <div
        className={clsx(s.settingControl, {
          [s.settingControlRight]: setting.type === 'boolean',
        })}
      >
        <Form.Field name={name} showError={false} className={s.formFieldReset}>
          {renderInput()}
        </Form.Field>
        {canWrite && setting.defaultEnvVar && isOverridden && (
          <button
            type='button'
            className={s.resetBtn}
            onClick={handleReset}
            title={t('admin:settings.resetToDefault', 'Reset to env default')}
          >
            <Icon name='rotate-ccw' size={12} />
          </button>
        )}
      </div>
    </div>
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
// Namespace icons — maps module names to feather icons
// =============================================================================

const NAMESPACE_ICONS = Object.freeze({
  core: 'globe',
  auth: 'lock',
  email: 'mail',
  files: 'folder',
  search: 'search',
  webhooks: 'zap',
});

function getNamespaceIcon(ns) {
  return NAMESPACE_ICONS[ns] || 'settings';
}

// Enterprise-grade logical ordering for tabs
const NAMESPACE_ORDER = [
  'core',
  'auth',
  'email',
  'files',
  'search',
  'webhooks',
  'system',
];

function sortNamespaces(namespaces) {
  return [...namespaces].sort((a, b) => {
    const idxA = NAMESPACE_ORDER.indexOf(a);
    const idxB = NAMESPACE_ORDER.indexOf(b);
    if (idxA === -1 && idxB === -1) return a.localeCompare(b);
    if (idxA === -1) return 1; /* unlisted go to bottom */
    if (idxB === -1) return -1;
    return idxA - idxB;
  });
}

function getNamespaceLabel(ns, t) {
  const defaultLabels = {
    core: 'General',
    auth: 'Authentication',
    email: 'Email Configuration',
    files: 'File Storage',
    search: 'Search Engine',
    webhooks: 'Webhooks',
  };
  return t(`admin:settings.namespaces.${ns}`, defaultLabels[ns] || ns);
}

// Enterprise-grade logical ordering for fields within namespaces
const SETTING_FIELD_ORDER = Object.freeze({
  core: ['APP_NAME', 'APP_DESCRIPTION', 'MAINTENANCE_MODE'],
  auth: ['ALLOW_REGISTRATION', 'SESSION_TTL'],
  email: ['FROM_NAME', 'FROM_ADDRESS'],
  files: ['STORAGE_PROVIDER', 'ALLOWED_EXTENSIONS', 'MAX_UPLOAD_SIZE_MB'],
  search: ['SEARCH_ENGINE', 'AUTO_INDEX'],
  webhooks: ['REQUIRE_SIGNATURE', 'WEBHOOK_TIMEOUT_MS', 'MAX_RETRY_ATTEMPTS'],
});

function sortSettingFields(namespace, settings) {
  const order = SETTING_FIELD_ORDER[namespace] || [];
  return [...settings].sort((a, b) => {
    const idxA = order.indexOf(a.key);
    const idxB = order.indexOf(b.key);
    if (idxA === -1 && idxB === -1) return a.key.localeCompare(b.key);
    if (idxA === -1) return 1;
    if (idxB === -1) return -1;
    return idxA - idxB;
  });
}

// =============================================================================
// Settings Builder Form
// =============================================================================

function SettingsBuilderForm({ namespace, settings }) {
  const { t } = useTranslation();
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
    return sortSettingFields(namespace, settings);
  }, [namespace, settings]);

  const defaultValues = useMemo(() => {
    const vals = {};
    settings.forEach(item => {
      let val = item.value;
      if (item.type === 'boolean') {
        val = val === 'true' || val === true;
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
          dispatch(fetchSettings());
        }
      }
    },
    [dispatch, namespace],
  );

  return (
    <Form defaultValues={defaultValues} onSubmit={handleSave}>
      <Card variant='default'>
        <Card.Header>
          <div className={s.panelHeader}>
            <Icon name={getNamespaceIcon(namespace)} size={20} />
            <h3 className={s.panelTitle}>{getNamespaceLabel(namespace, t)}</h3>
            {canWrite && (
              <div className={s.panelHeaderActions}>
                <SaveButton />
              </div>
            )}
          </div>
        </Card.Header>
        <Card.Body className={s.panelBody}>
          {sortedFields.map(setting => (
            <SettingRow
              key={`${setting.namespace}___${setting.key}`}
              setting={setting}
              canWrite={canWrite}
            />
          ))}
        </Card.Body>
      </Card>
    </Form>
  );
}

SettingsBuilderForm.propTypes = {
  namespace: PropTypes.string.isRequired,
  settings: PropTypes.array.isRequired,
};

// =============================================================================
// Main component
// =============================================================================

function SettingsPage() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { hasPermission } = useRbac();

  const groups = useSelector(selectGroups);
  const loading = useSelector(selectLoading);
  const initialized = useSelector(selectInitialized);
  const error = useSelector(selectError);

  const [activeTab, setActiveTab] = useState(null);

  const rawNamespaces = useMemo(
    () => (groups ? sortNamespaces(Object.keys(groups)) : []),
    [groups],
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

  // Set first namespace as active tab when data loads
  useEffect(() => {
    if (!activeTab && namespaces.length > 0) {
      setActiveTab(namespaces[0]);
    }
  }, [namespaces, activeTab]);

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (!initialized || (loading && namespaces.length === 0)) {
    return (
      <div className={s.root}>
        <Box.Header
          icon={<Icon name='settings' size={24} />}
          title={t('admin:settings.title', 'Global Settings')}
          subtitle={t(
            'admin:settings.subtitle',
            'Configure system-wide settings',
          )}
        />
        <Loader
          variant='skeleton'
          message={t('admin:settings.loading', 'Loading settings...')}
        />
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className={s.root}>
        <Box.Header
          icon={<Icon name='settings' size={24} />}
          title={t('admin:settings.title', 'Global Settings')}
        />
        <Table.Error
          title={t('admin:settings.errorLoading', 'Error loading settings')}
          error={error}
          retryLabel={t('admin:common.retry', 'Retry')}
          onRetry={() => dispatch(fetchSettings())}
        />
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className={s.root}>
      <Box.Header
        icon={<Icon name='settings' size={24} />}
        title={t('admin:settings.title', 'Global Settings')}
        subtitle={t(
          'admin:settings.subtitle',
          'Configure system-wide settings for all modules',
        )}
      />

      <div className={s.layout}>
        {/* Namespace tabs */}
        <nav className={s.tabs}>
          {namespaces.map(ns => (
            <button
              key={ns}
              type='button'
              className={`${s.tab} ${activeTab === ns ? s.tabActive : ''}`}
              onClick={() => setActiveTab(ns)}
            >
              <Icon name={getNamespaceIcon(ns)} size={16} />
              <span className={s.tabLabel}>{getNamespaceLabel(ns, t)}</span>
              <span className={s.tabCount}>{groups[ns].length}</span>
            </button>
          ))}
        </nav>

        {/* Settings panel */}
        <div className={s.panel}>
          {activeTab && groups[activeTab] && (
            <SettingsBuilderForm
              key={activeTab}
              namespace={activeTab}
              settings={groups[activeTab]}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;
