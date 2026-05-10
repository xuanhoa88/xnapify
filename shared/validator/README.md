# Shared Validator

An internalized Zod integration seamlessly married to the isomorphic `@shared/i18n` library. It translates raw Zod validation errors into human-readable, locale-aware messages out of the box, and provides high-level utilities for component and API validation routines.

## Quick Start

```javascript
import { validateForm, z } from '@shared/validator';

// 1. Define a schema factory. This allows access to translation helpers inside the schema itself if needed.
const loginSchema = ({ i18n, z }) =>
  z.object({
    email: z.string().email(),
    password: z.string().min(8),
  });

// 2. Validate arbitrary data payload against the factory
const [isValid, dataOrErrors] = validateForm(loginSchema, {
  email: 'not-an-email',
  password: '123',
});

if (!isValid) {
  console.log(dataOrErrors);
  // Outputs translated arrays:
  // { email: ["Invalid email"], password: ["Must be at least 8 characters"] }
} else {
  console.log('Validated payload:', dataOrErrors);
}
```

## Features

- **Global i18n Integration**: Automatically registers a custom `z.setErrorMap()` overlay. Every failing Zod rule (e.g., `invalid_string`, `too_small`) is intercepted and piped through `i18n.t()`.
- **Pre-bundled Translations**: Loads Zod-specific translation maps from its own nested `translations/` directory on boot, ensuring validation errors respond to the active `lng` transparently.
- **Custom Error Keys**: Developers can pass exact i18n template keys to specific constraints.
  ```javascript
  z.string().min(5, { params: { i18n: 'my_module.custom_error' } });
  ```
- **Error Formatting Suite**: Exports utilities (`formatZodError`, `formatZodErrorToObject`, `formatZodErrorToArray`) designed to squish complex issue graphs down to flat strings, grouped objects, or API-friendly JSON arrays.

## Custom Translations for Specific Paths

The error mapper natively attempts to resolve "path-specific" error messages first before falling back to generics.

For the constraint `z.string().email()` on a key named `userEmail`, the mapper attempts to resolve an i18n key ending in `WithPath` containing the path variable.

---

# Shared Validator — Technical Specification

## Overview

The `shared/validator/` directory houses a unified `zod` wrapper.

By default, Zod hardcodes English validation messages deep within its core logic. This library rips out those hardcoded messages and bridges them into the enterprise `i18n` service via a custom `z.setErrorMap(...)` interceptor.

## Architectural Concepts

### Dynamic Schema Factories

Validation objects in xnapify are rarely defined statically. Because `i18n` relies heavily on the React Context (or the incoming HTTP Request Context) to determine the user's language, defining static schemas globally causes translation freezing (it resolves against the default language once at boot up).

To counter this, `validateForm(schemaFactory, data)` expects `schemaFactory` to be a function that evaluates and executes _at the moment of validation_, securely binding the active locale into error generation.

### The Interceptor (`index.js`)

1. Registers `zod` as a new namespace within the i18n memory pool fetching JSON files automatically via Rspack's `import.meta.webpackContext('./translations')`.
2. Registers a global `z.setErrorMap((issue, ctx) => {...})` interceptor.
3. Performs deep AST inspection of the raw Zod `issue` determining the root `ZodIssueCode`.
4. Maps rules into specific flattened translation paths. Examples:
   - `ZodIssueCode.invalid_string` maps to `zod:errors.invalid_string.[validationType]`.
   - `ZodIssueCode.too_small` factors in `type`, `exact`, and `inclusive` booleans resolving templates like `zod:errors.too_small.string.inclusive`.

### Error Formatters (`formatter.js`)

Provides utility mechanisms to restructure Zod's internal issue arrays:

- `formatZodErrorToObject(zodError, options)`: Accumulates issues into nested objects grouping array strings by standard object dot-notation keys. Essential for matching errors against React/HTML form `<input name="email" />` fields.
- `formatZodErrorToArray(zodError)`: Restructures payload back into flat JSON. Designed for consistent API HTTP 422 JSON validation responses.
- `formatZodError(zodError)`: Squishes validation issues down into a single massive concatenated string for crash logging or simple toast messages.
