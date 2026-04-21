/**
 * Settings redux slice — re-exports from the shared renderer layer.
 *
 * The canonical slice lives in shared/renderer/redux/features/settings.
 * This file exists for backward compatibility with direct imports from
 * within the settings module.
 */

export {
  default,
  fetchPublicSettings,
  selectSetting,
} from '@shared/renderer/redux/features/settings/slice';
