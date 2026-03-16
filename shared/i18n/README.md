# Shared i18n

Isomorphic internationalization library wrapping `i18next` and `react-i18next`. It handles locale resolution, language names, and dynamic namespace loading for modular applications.

## Quick Start

```javascript
import i18n, { addNamespace } from '@shared/i18n';

// i18n is pre-configured and ready to use
console.log(i18n.t('hello'));

// Dynamically add a namespace from a module
addNamespace('users', {
  'en-US': { title: 'Users' },
  'vi-VN': { title: 'Người dùng' }
});
```

## Features

- **Pre-configured Singleton**: Immediate synchronous initialization for SSR and Client usage safely.
- **Default Translations**: Auto-loads standard translation files from `shared/i18n/translations/*.json`.
- **Locale Resolution**: Computes native locale display names automatically using `Intl.DisplayNames`.
- **Dynamic Namespaces**: Add and remove namespace bundles on the fly across all active locales.
- **Lazy Loading Helper**: Built-in function to conditionally load translation dictionaries.
- **Webpack & Vite Support**: Includes a compatible context loader for `require.context` / `import.meta.glob`.

## Usage Guide

### Using the Instance

The default export is the fully initialized `i18next` instance.

```javascript
import i18n from '@shared/i18n';

// Use directly
i18n.changeLanguage('vi-VN');
const msg = i18n.t('myNamespace:key');
```

In React components, use `react-i18next` directly:

```javascript
import { useTranslation } from 'react-i18next';

function MyView() {
  const { t } = useTranslation(['translation', 'users']);
  return <h1>{t('users:title')}</h1>;
}
```

### Dynamic Namespace Management

When lazily loading route views or booting APIs, you can dynamically inject namespaces:

```javascript
import { addNamespace, removeNamespace, hasNamespace } from '@shared/i18n';

const translations = {
  'en-US': { hello: 'Hello' },
  'vi-VN': { hello: 'Xin chào' }
};

// Add
addNamespace('myFeature', translations);

// Check
if (hasNamespace('myFeature')) { ... }

// Remove (cleanup)
removeNamespace('myFeature');
```

For promise-based asynchronous loading (code splitting):

```javascript
import { ensureNamespaceLoaded } from '@shared/i18n';

await ensureNamespaceLoaded('myFeature', async () => {
  const mod = await import('./locales.js');
  return mod.default;
});
```

### Auto-loading Directories

`getTranslations(requireContext)` is exposed to simplify loading a directory of JSON files (e.g. `*.json`).

```javascript
import { getTranslations } from '@shared/i18n';

const ctx = require.context('./translations', false, /\.json$/i);
const translationsMap = getTranslations(ctx);
// -> { 'en-US': { ... }, 'vi-VN': { ... } }
```

## See Also

- [SPEC.md](./SPEC.md) — Technical specification
