---
name: i18n-localization
description: Internationalization and localization patterns. Detecting hardcoded strings, managing translations, locale files, RTL support.
allowed-tools: Read, Glob, Grep
---

# i18n & Localization

> Internationalization (i18n) and Localization (L10n) best practices.

---

## 1. Core Concepts

| Term       | Meaning                                        |
| ---------- | ---------------------------------------------- |
| **i18n**   | Internationalization - making app translatable |
| **L10n**   | Localization - actual translations             |
| **Locale** | Language + Region (en-US, tr-TR)               |
| **RTL**    | Right-to-left languages (Arabic, Hebrew)       |

---

## 2. When to Use i18n

| Project Type      | i18n Needed?       |
| ----------------- | ------------------ |
| Public web app    | ✅ Yes             |
| SaaS product      | ✅ Yes             |
| Internal tool     | ⚠️ Maybe           |
| Single-region app | ⚠️ Consider future |
| Personal project  | ❌ Optional        |

---

## 3. Implementation Patterns

### 1. File Structure

```
src/apps/[module_name]/
└── translations/
    ├── en-US.json
    └── vi-VN.json
```

Or for plugins:

```
src/plugins/[plugin-name]/
└── translations/
    ├── en-US.json
    └── vi-VN.json
```

### 2. Registering Translations

Translations are dynamically discovered by the global `AppRouter`. 
Any App or Plugin that provides `.json` translation files must explicitly export a `translations()` hook inside its respective index loop (e.g. `src/apps/[module]/views/index.js` or `src/apps/[module]/views/(default)/_route.js`):

```javascript
// Load translations using Webpack context
const translationsContext = require.context(
  '../../../translations',
  false,
  /\.json$/i,
);

/**
 * Translations hook — returns the webpack require.context for this module's translations.
 */
export function translations() {
  return translationsContext;
}
```

### 3. Usage in React (react-i18next)

```tsx
import { useTranslation } from 'react-i18next';

function Welcome() {
  const { t } = useTranslation();
  return <h1>{t('namespace:welcome.title', 'Default Title')}</h1>;
}
```

### 4. Usage in Server/Router context

During SSR, Route Definitions, or API middlewares, the `i18n` object is typically passed down via context:

```javascript
export async function getInitialProps({ i18n }) {
  return {
    title: i18n.t('namespace:page.title', 'File Title'),
  };
}
```

---

## 5. Best Practices

### DO ✅

- Use translation keys, not raw text
- Namespace translations by feature
- Support pluralization
- Handle date/number formats per locale
- Plan for RTL from the start
- Use ICU message format for complex strings

### DON'T ❌

- Hardcode strings in components
- Concatenate translated strings
- Assume text length (German is 30% longer)
- Forget about RTL layout
- Mix languages in same file

---

## 6. Common Issues

| Issue               | Solution                     |
| ------------------- | ---------------------------- |
| Missing translation | Fallback to default language |
| Hardcoded strings   | Use linter/checker script    |
| Date format         | Use Intl.DateTimeFormat      |
| Number format       | Use Intl.NumberFormat        |
| Pluralization       | Use ICU message format       |

---

## 7. RTL Support

```css
/* CSS Logical Properties */
.container {
  margin-inline-start: 1rem; /* Not margin-left */
  padding-inline-end: 1rem; /* Not padding-right */
}

[dir='rtl'] .icon {
  transform: scaleX(-1);
}
```

---

## 8. Checklist

Before shipping:

- [ ] All user-facing strings use translation keys
- [ ] Locale files exist for all supported languages
- [ ] Date/number formatting uses Intl API
- [ ] RTL layout tested (if applicable)
- [ ] Fallback language configured
- [ ] No hardcoded strings in components

---

## Script

| Script                    | Purpose                                         | Command                                         |
| ------------------------- | ----------------------------------------------- | ----------------------------------------------- |
| `scripts/i18n_checker.py` | Detect hardcoded strings & missing translations | `python scripts/i18n_checker.py <project_path>` |
