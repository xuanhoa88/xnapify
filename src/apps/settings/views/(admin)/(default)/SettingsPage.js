/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useEffect, useCallback, useState, useMemo } from 'react';

import clsx from 'clsx';
import sortBy from 'lodash/sortBy';
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

import { useSettingsTabConfig } from '../hooks/useSettingsTabConfig';
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
            <Form.Textarea
              disabled={!canWrite}
              rows={3}
              spellCheck={false}
              className={s.textarea}
            />
          );
        }
        return <Form.Input disabled={!canWrite} />;
      }
    }
  };

  return (
    <div className={s.settingRow}>
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
// Namespace helpers
// =============================================================================

/**
 * Resolve namespace label with i18n-first cascade:
 * 1. Extension-provided i18nKey (extension owns its own translations)
 * 2. Core i18n key (settings module translations)
 * 3. Hardcoded label fallback from config
 * 4. Raw namespace string
 */
function getNamespaceLabel(ns, t, labels, translationKeys) {
  // Hardcoded label fallback
  const fallback = labels[ns] || ns;

  // 1. Extension-provided i18n key overrides core translation
  if (translationKeys[ns]) {
    // If the extension key exists in loaded bundles, use it.
    // We try translationKeys[ns] first. If not found, we fallback to the core translation.
    const extTranslated = t(translationKeys[ns], { defaultValue: '' });
    if (extTranslated) return extTranslated;
  }

  // 2. Core module i18n key, natively falling back to the hardcoded label
  const coreKey = `admin:settings.namespaces.${ns}`;
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

function sortSettingFields(namespace, settings, fieldOrder) {
  const order = (fieldOrder && fieldOrder[namespace]) || [];
  return sortBy(settings, [
    setting => {
      const idx = order.indexOf(setting.key);
      return idx === -1 ? Infinity : idx;
    },
    setting => setting.key,
  ]);
}

// =============================================================================
// Settings Builder Form
// =============================================================================

function SettingsBuilderForm({ namespace, settings, fieldOrder, onSaved }) {
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
    return sortSettingFields(namespace, settings, fieldOrder);
  }, [namespace, settings, fieldOrder]);

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
          // Reset the form with submitted data so dirty state clears immediately
          methods.reset(data);
          // Then refresh from server to pick up any server-side transformations
          dispatch(fetchSettings());
          if (typeof onSaved === 'function') onSaved(namespace);
        }
      }
    },
    [dispatch, namespace, onSaved],
  );

  return (
    <Form defaultValues={defaultValues} onSubmit={handleSave}>
      <Card variant='default'>
        <Card.Body className={s.panelBody}>
          {sortedFields.map(setting => (
            <SettingRow
              key={`${setting.namespace}___${setting.key}`}
              setting={setting}
              canWrite={canWrite}
            />
          ))}
        </Card.Body>
        {canWrite && (
          <Card.Footer align='right'>
            <SaveButton />
          </Card.Footer>
        )}
      </Card>
    </Form>
  );
}

SettingsBuilderForm.propTypes = {
  namespace: PropTypes.string.isRequired,
  settings: PropTypes.array.isRequired,
  fieldOrder: PropTypes.object.isRequired,
  onSaved: PropTypes.func,
};

// =============================================================================
// Main component
// =============================================================================

function SettingsPage({ context }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { hasPermission } = useRbac();

  const { icons, labels, translationKeys, order, fieldOrder } =
    useSettingsTabConfig(context.container.resolve('extension'));

  const groups = useSelector(selectGroups);
  const loading = useSelector(selectLoading);
  const initialized = useSelector(selectInitialized);
  const error = useSelector(selectError);

  const [activeTab, setActiveTab] = useState(null);

  // Only show namespaces that are core or registered by active extensions.
  // This hides settings from deactivated extensions while preserving their DB data.
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
          variant='spinner'
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
              <Icon name={icons[ns] || 'settings'} size={16} />
              <span className={s.tabLabel}>
                {getNamespaceLabel(ns, t, labels, translationKeys)}
              </span>
              <span className={s.tabCount}>{groups[ns].length}</span>
            </button>
          ))}
        </nav>

        {/* Settings panel — only the active tab is mounted */}
        <div className={s.panel}>
          {activeTab && groups[activeTab] && (
            <SettingsBuilderForm
              key={activeTab}
              namespace={activeTab}
              settings={groups[activeTab]}
              fieldOrder={fieldOrder}
            />
          )}
        </div>
      </div>
    </div>
  );
}

SettingsPage.propTypes = {
  context: PropTypes.shape({
    container: PropTypes.object.isRequired,
  }).isRequired,
};

export default SettingsPage;
