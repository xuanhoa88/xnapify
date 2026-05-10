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
  'vi-VN': { title: 'Người dùng' },
});
```

## Features

- **Pre-configured Singleton**: Immediate synchronous initialization for SSR and Client usage safely.
- **Default Translations**: Auto-loads standard translation files from `shared/i18n/translations/*.json`.
- **Locale Resolution**: Computes native locale display names automatically using `Intl.DisplayNames`.
- **Dynamic Namespaces**: Add and remove namespace bundles on the fly across all active locales.
- **Lazy Loading Helper**: Built-in function to conditionally load translation dictionaries.
- **Rspack & Vite Support**: Includes a compatible context loader for `import.meta.webpackContext` / `import.meta.glob`.

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

const ctx = import.meta.webpackContext('./translations', {
  recursive: false,
  regExp: /\.json$/i,
});
const translationsMap = getTranslations(ctx);
// -> { 'en-US': { ... }, 'vi-VN': { ... } }
```

---

# Shared i18n — Technical Specification

## Overview

The `shared/i18n/` library provides internationalization capabilities powered by `i18next`. It exports a fully initialized singleton and exposes utilities for dynamically injecting namespaced translations at runtime.

## Architecture

```
shared/i18n/
├── index.js          # Main entrypoint, default locale loader
├── getInstance.js    # Synchronous i18n instance creation & configuration
├── loader.js         # Rspack/Vite context parsing for JSON files
└── utils.js          # Dynamic namespace injection/removal logic
```

## Initial Setup (`getInstance.js`)

1. **Instantiation**: `i18n.createInstance()` creates an independent instance.
2. **Configuration**: Configures `react-i18next` directly synchronously (`init({ ... })`).
   - Hardcoded default namespace: `translation`.
   - Enables `react.useSuspense: false` which is strictly required for seamless isomorphic SSR rendering.

## Built-in Locales (`index.js`)

On initialization, `index.js` traverses `shared/i18n/translations/*.json` via `import.meta.webpackContext`:

- It builds `DEFAULT_RESOURCES` mapping locales to dictionary objects.
- It builds `AVAILABLE_LOCALES` mapping keys to highly readable native language names using standard `Intl.DisplayNames()`.
- It injects all loaded dictionaries into the foundational `translation` namespace via `i18n.addResourceBundle`.

## Dynamic Workflows (`utils.js`)

Because the application modularity splits functionalities into different folders, loading all translations globally upfront creates gigantic bundles. The `utils.js` provides runtime augmentation logic.

### `addNamespace(namespace, translations, [i18nInstance])`

Accepts a structure like `{'en-US': { key: 'val' }, ...}`.

1. Pushes the string to `i18n.options.ns` array.
2. Loops over every locale key provided and executes `i18n.addResourceBundle(locale, namespace, data, true, true)`.

### `removeNamespace(namespace, [i18nInstance])`

Tears down a dynamically added namespace from memory.

- Filters the `i18n.options.ns` array.
- Uses `getStoreLocales()` (which inspects actual runtime `store.data` rather than initial configuration) to iterate active languages and invoke `i18n.removeResourceBundle()`.

### `hasNamespace(namespace, [i18nInstance])`

Verifies if a namespace is actively loaded. It checks two conditions:

1. Is it included in `i18n.options.ns`?
2. Does it exist in the store under _any_ active locale? (`i18n.store.data[loc][ns]`)

### `ensureNamespaceLoaded(namespace, loader, [i18nInstance])`

An async wrapper. If `hasNamespace()` returns `false`, it executes the `loader()` promise, receives the translation dictionary mapping, and then calls `addNamespace()`.

## Loader Extraction (`loader.js`)

`getTranslations(adapter)` abstracts the iteration of `import.meta.webpackContext` constructs.

1. Utilizes `@shared/utils/contextAdapter` to handle both pure `import.meta.webpackContext` or already-adapted modules.
2. Applies regex `([^/]+)\.json$/i` to extract the exact locale name from the filename.
3. Consolidates into an object of translations mapped by Locale Code.
