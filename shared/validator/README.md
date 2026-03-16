# Shared Validator

An internalized Zod integration seamlessly married to the isomorphic `@shared/i18n` library. It translates raw Zod validation errors into human-readable, locale-aware messages out of the box, and provides high-level utilities for component and API validation routines.

## Quick Start

```javascript
import { validateForm, z } from '@shared/validator';

// 1. Define a schema factory. This allows access to translation helpers inside the schema itself if needed.
const loginSchema = ({ i18n, z }) => z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

// 2. Validate arbitrary data payload against the factory
const [isValid, dataOrErrors] = validateForm(loginSchema, {
  email: 'not-an-email',
  password: '123'
});

if (!isValid) {
  console.log(dataOrErrors); 
  // Outputs translated arrays: 
  // { email: ["Invalid email"], password: ["Must be at least 8 characters"] }
} else {
  console.log("Validated payload:", dataOrErrors);
}
```

## Features

- **Global i18n Integration**: Automatically registers a custom `z.setErrorMap()` overlay. Every failing Zod rule (e.g., `invalid_string`, `too_small`) is intercepted and piped through `i18n.t()`.
- **Pre-bundled Translations**: Loads Zod-specific translation maps from its own nested `translations/` directory on boot, ensuring validation errors respond to the active `lng` transparently.
- **Custom Error Keys**: Developers can pass exact i18n template keys to specific constraints.
  ```javascript
  z.string().min(5, { params: { i18n: 'my_module.custom_error' } })
  ```
- **Error Formatting Suite**: Exports utilities (`formatZodError`, `formatZodErrorToObject`, `formatZodErrorToArray`) designed to squish complex issue graphs down to flat strings, grouped objects, or API-friendly JSON arrays.

## Custom Translations for Specific Paths

The error mapper natively attempts to resolve "path-specific" error messages first before falling back to generics. 

For the constraint `z.string().email()` on a key named `userEmail`, the mapper attempts to resolve an i18n key ending in `WithPath` containing the path variable.

## See Also
- [SPEC.md](./SPEC.md) — Technical specification
