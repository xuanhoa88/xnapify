/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useEffect, useCallback } from 'react';

// =============================================================================
// Core defaults — immutable baseline for built-in namespaces
// =============================================================================

const CORE_ICONS = Object.freeze({
  core: 'globe',
  auth: 'lock',
  email: 'mail',
  file: 'folder',
  webhook: 'zap',
});

const CORE_LABELS = Object.freeze({
  core: 'General',
  auth: 'Authentication',
  email: 'Email',
  file: 'File Storage',
  webhook: 'Webhook',
});

const CORE_ORDER = Object.freeze([
  'core',
  'auth',
  'email',
  'file',
  'webhook',
  'system',
]);

const CORE_FIELD_ORDER = Object.freeze({
  core: ['APP_NAME', 'APP_DESCRIPTION', 'MAINTENANCE_MODE'],
  auth: ['ALLOW_REGISTRATION', 'SESSION_TTL'],
  email: ['FROM_NAME', 'FROM_ADDRESS'],
  file: ['STORAGE_PROVIDER', 'ALLOWED_EXTENSIONS', 'MAX_UPLOAD_SIZE_MB'],
  webhook: ['REQUIRE_SIGNATURE', 'WEBHOOK_TIMEOUT_MS', 'MAX_RETRY_ATTEMPTS'],
});

/** Hook ID used by extensions to register settings tab metadata */
const HOOK_ID = 'settings.tabs.config';

// =============================================================================
// Initial state (pre-extension merge)
// =============================================================================

const INITIAL_STATE = {
  icons: { ...CORE_ICONS },
  labels: { ...CORE_LABELS },
  translationKeys: {},
  order: [...CORE_ORDER],
  fieldOrder: { ...CORE_FIELD_ORDER },
};

// =============================================================================
// Hook
// =============================================================================

/**
 * useSettingsTabConfig
 *
 * Merges core defaults with extension-provided tab metadata registered
 * via `registry.registerHook('settings.tabs.config', callback)`.
 *
 * Extensions return: `{ [namespace]: { icon, label, i18nKey, order, fieldOrder } }`
 *
 * @param {Object} extension - The extension manager
 * @returns {{ icons, labels, translationKeys, order, fieldOrder, loading }}
 */
export function useSettingsTabConfig(extension) {
  const { registry } = extension;

  const [config, setConfig] = useState(INITIAL_STATE);
  const [loading, setLoading] = useState(true);

  const resolve = useCallback(
    async mountedIndicator => {
      // If no extensions registered or registry missing, skip the merge
      if (!registry || !registry.hasHook(HOOK_ID)) {
        if (mountedIndicator && mountedIndicator.current) setLoading(false);
        return;
      }

      const results = await registry.executeHook(HOOK_ID);

      const mergedIcons = { ...CORE_ICONS };
      const mergedLabels = { ...CORE_LABELS };
      const mergedTranslationKeys = {};
      const mergedFieldOrder = { ...CORE_FIELD_ORDER };
      const extraOrder = [];

      for (const result of results) {
        if (!result || typeof result !== 'object') continue;

        for (const [ns, cfg] of Object.entries(result)) {
          if (!cfg || typeof cfg !== 'object') continue;

          // Warn on conflict in dev mode
          if (__DEV__ && mergedIcons[ns] && !CORE_ICONS[ns] && cfg.icon) {
            console.warn(
              `[useSettingsTabConfig] Icon conflict for namespace "${ns}" — last writer wins`,
            );
          }

          if (cfg.icon) mergedIcons[ns] = cfg.icon;
          if (cfg.label) mergedLabels[ns] = cfg.label;
          if (cfg.i18nKey) mergedTranslationKeys[ns] = cfg.i18nKey;
          if (cfg.fieldOrder) mergedFieldOrder[ns] = cfg.fieldOrder;
          if (cfg.order != null && !CORE_ORDER.includes(ns)) {
            extraOrder.push({ ns, order: cfg.order });
          }
        }
      }

      // Insert extension namespaces before 'system' (always last)
      extraOrder.sort((a, b) => a.order - b.order);
      const finalOrder = [...CORE_ORDER];
      const systemIdx = finalOrder.indexOf('system');
      for (const { ns } of extraOrder) {
        if (!finalOrder.includes(ns)) {
          finalOrder.splice(
            systemIdx >= 0 ? systemIdx : finalOrder.length,
            0,
            ns,
          );
        }
      }

      if (mountedIndicator && mountedIndicator.current) {
        setConfig({
          icons: mergedIcons,
          labels: mergedLabels,
          translationKeys: mergedTranslationKeys,
          order: finalOrder,
          fieldOrder: mergedFieldOrder,
        });
        setLoading(false);
      }
    },
    [registry],
  );

  useEffect(() => {
    const mounted = { current: true };
    resolve(mounted);

    const unsubscribe = registry.subscribe(() => resolve(mounted));

    return () => {
      mounted.current = false;
      unsubscribe();
    };
  }, [resolve, registry]);

  return { ...config, loading };
}
