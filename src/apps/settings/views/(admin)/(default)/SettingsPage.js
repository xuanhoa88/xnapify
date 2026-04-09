/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useEffect, useCallback, useState, useMemo } from 'react';

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
  saveSettings,
  selectGroups,
  selectLoading,
  selectError,
  selectSaving,
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
  const { setValue } = useFormContext();

  const name = `${setting.namespace}___${setting.key}`;

  const handleReset = useCallback(() => {
    setValue(name, null, { shouldDirty: true });
  }, [name, setValue]);

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
            <span className={`${s.badge} ${s.badgePublic}`}>public</span>
          )}
          {setting.isDefault && (
            <span className={`${s.badge} ${s.badgeDefault}`}>env default</span>
          )}
        </div>
        {setting.description && (
          <p className={s.settingDesc}>{setting.description}</p>
        )}
        {setting.defaultEnvVar && (
          <p className={s.settingEnvHint}>
            Fallback: <code>{setting.defaultEnvVar}</code>
          </p>
        )}
      </div>
      <div className={s.settingControl}>
        <Form.Field name={name} showError={false} className={s.formFieldReset}>
          {renderInput()}
        </Form.Field>
        {canWrite && setting.defaultEnvVar && (
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
  return namespaces.sort((a, b) => {
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

// =============================================================================
// Main component
// =============================================================================

function SettingsPage() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { hasPermission } = useRbac();
  const canWrite = hasPermission('settings:write');

  const groups = useSelector(selectGroups);
  const loading = useSelector(selectLoading);
  const saving = useSelector(selectSaving);
  const initialized = useSelector(selectInitialized);
  const error = useSelector(selectError);

  const [activeTab, setActiveTab] = useState(null);

  useEffect(() => {
    dispatch(fetchSettings());
  }, [dispatch]);

  // Set first namespace as active tab when data loads
  useEffect(() => {
    if (!activeTab && groups) {
      const sortedNamespaces = sortNamespaces(Object.keys(groups));
      if (sortedNamespaces.length > 0) {
        setActiveTab(sortedNamespaces[0]);
      }
    }
  }, [groups, activeTab]);

  const defaultValues = useMemo(() => {
    if (!groups) return {};
    const vals = {};
    Object.values(groups).forEach(settings => {
      settings.forEach(item => {
        let val = item.value;
        if (item.type === 'boolean') {
          val = val === 'true' || val === true;
        }
        vals[`${item.namespace}___${item.key}`] = val;
      });
    });
    return vals;
  }, [groups]);

  const handleSave = useCallback(
    async (data, methods) => {
      const dirty = methods.formState.dirtyFields;
      if (Object.keys(dirty).length === 0) return;

      const updates = Object.keys(dirty).map(dirtyKey => {
        const [namespace, ...keyParts] = dirtyKey.split('___');
        const key = keyParts.join('___');
        let value = data[dirtyKey];

        if (value === null) {
          // Keep as null
        } else if (typeof value === 'boolean') {
          value = value ? 'true' : 'false';
        } else if (value === undefined) {
          value = '';
        } else {
          value = String(value);
        }

        return { namespace, key, value };
      });

      if (updates.length > 0) {
        const result = await dispatch(saveSettings(updates));
        if (!result.error) {
          dispatch(fetchSettings());
        }
      }
    },
    [dispatch],
  );

  const namespaces = useMemo(
    () => (groups ? sortNamespaces(Object.keys(groups)) : []),
    [groups],
  );

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
    <Form
      defaultValues={defaultValues}
      onSubmit={handleSave}
      className={s.root}
    >
      <Box.Header
        icon={<Icon name='settings' size={24} />}
        title={t('admin:settings.title', 'Global Settings')}
        subtitle={t(
          'admin:settings.subtitle',
          'Configure system-wide settings for all modules',
        )}
      >
        {canWrite && <SaveButton />}
      </Box.Header>

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
            <Card variant='default'>
              <Card.Header>
                <div className={s.panelHeader}>
                  <Icon name={getNamespaceIcon(activeTab)} size={20} />
                  <h3 className={s.panelTitle}>
                    {getNamespaceLabel(activeTab, t)}
                  </h3>
                </div>
              </Card.Header>
              <Card.Body className={s.panelBody}>
                {groups[activeTab].map(setting => (
                  <SettingRow
                    key={`${setting.namespace}___${setting.key}`}
                    setting={setting}
                    canWrite={canWrite}
                  />
                ))}
              </Card.Body>
            </Card>
          )}
        </div>
      </div>
    </Form>
  );
}

export default SettingsPage;
