# Shared Validator — Technical Specification

## Overview

The `shared/validator/` directory houses a unified `zod` wrapper. 

By default, Zod hardcodes English validation messages deep within its core logic. This library rips out those hardcoded messages and bridges them into the enterprise `i18n` service via a custom `z.setErrorMap(...)` interceptor. 

## Architectural Concepts

### Dynamic Schema Factories
Validation objects in Rapid RSK are rarely defined statically. Because `i18n` relies heavily on the React Context (or the incoming HTTP Request Context) to determine the user's language, defining static schemas globally causes translation freezing (it resolves against the default language once at boot up).

To counter this, `validateForm(schemaFactory, data)` expects `schemaFactory` to be a function that evaluates and executes *at the moment of validation*, securely binding the active locale into error generation.

### The Interceptor (`index.js`)

1. Registers `zod` as a new namespace within the i18n memory pool fetching JSON files automatically via Webpack's `require.context('./translations')`.
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
