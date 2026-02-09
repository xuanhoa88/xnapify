import { getTranslations } from '../../../shared/i18n/getTranslations';
import { addNamespace } from '../../../shared/i18n/addNamespace';
import { PLUGIN_ID } from '../constants';

// Export a function to register translations using the shared i18n instance
export function registerTranslations(i18n) {
  addNamespace(
    PLUGIN_ID,
    getTranslations(require.context('./', false, /\.json$/i)),
    i18n,
  );
}
