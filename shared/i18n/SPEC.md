# Shared i18n — Technical Specification

## Overview

The `shared/i18n/` library provides internationalization capabilities powered by `i18next`. It exports a fully initialized singleton and exposes utilities for dynamically injecting namespaced translations at runtime.

## Architecture

```
shared/i18n/
├── index.js          # Main entrypoint, default locale loader
├── getInstance.js    # Synchronous i18n instance creation & configuration
├── loader.js         # Webpack/Vite context parsing for JSON files
└── utils.js          # Dynamic namespace injection/removal logic
```

## Initial Setup (`getInstance.js`)

1. **Instantiation**: `i18n.createInstance()` creates an independent instance.
2. **Configuration**: Configures `react-i18next` directly synchronously (`init({ ... })`).
   - Hardcoded default namespace: `translation`.
   - Enables `react.useSuspense: false` which is strictly required for seamless isomorphic SSR rendering.

## Built-in Locales (`index.js`)

On initialization, `index.js` traverses `shared/i18n/translations/*.json` via `require.context`:
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
2. Does it exist in the store under *any* active locale? (`i18n.store.data[loc][ns]`)

### `ensureNamespaceLoaded(namespace, loader, [i18nInstance])`
An async wrapper. If `hasNamespace()` returns `false`, it executes the `loader()` promise, receives the translation dictionary mapping, and then calls `addNamespace()`.

## Loader Extraction (`loader.js`)

`getTranslations(adapter)` abstracts the iteration of `require.context` constructs.
1. Utilizes `@shared/utils/webpackContextAdapter` to handle both pure `require.context` or already-adapted modules.
2. Applies regex `([^/]+)\.json$/i` to extract the exact locale name from the filename.
3. Consolidates into an object of translations mapped by Locale Code.
