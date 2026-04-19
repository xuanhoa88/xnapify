# Form Architecture Specification

## Overview
The `Form` component system in xnapify is a highly composed abstraction built on top of [react-hook-form](https://react-hook-form.com/) and [Zod](https://zod.dev/). It leverages Radix UI primitives for its visual foundation and strictly encapsulates all state management, validation flows, and accessibility standardizations internally. 

The architecture is designed to enforce a single source of truth for validation schemas (via Zod), eliminate boilerplate from implementing common and complex inputs (like WYSIWYG or interactive JSON trees), and guarantee a unified design language across all modules.

## Architecture & Lifecycles

### Core Boundaries
1. **`<Form>`**: Acts as the ultimate provider wrapper. It initializes `react-hook-form`'s `useForm`, accepts the validation `schema`, manages the submission event wrapper, and syndicates its context down via `FormProvider` (from react-hook-form) and `FormValidationContext` (internal).
2. **`<Form.Field>`**: The mandatory structural shell for *any* input element. It controls the grid layout, pairs `<label>` tags with their matching input IDs, and automatically parses validation states to inject them into the child input (e.g. coloring the input red on failure).
3. **Input Implementations**: Highly specialized components (e.g., `Form.Input`, `Form.WYSIWYG`, `Form.CheckboxList`) that consume the `Form.Field` context to bind directly to the overarching `react-hook-form` state.

### Validation Pipeline
**Sync Validation**: 
Powered natively by `@hookform/resolvers/zod`. When passing a `schema` factory to `<Form>`, the architecture evaluates the Zod schema against the form data on every structural change (`mode: 'onChange'`), ensuring real-time feedback.

**Async Validation**:
Abstracted via the `useAsyncValidator` hook. Async validations (like "is this email already taken in the database?") are typically debounced and evaluated outside the synchronous Zod loop. `Form.Input` natively integrates this hook to display loading spinners and visual cues (`Form.Error`) during promise resolution.

## Context System

The architecture intentionally fail-fasts if context rules are violated. There are two primary contexts exposed:

- `FormValidationContext`: Exposes `{ schema, z }`. Consumed by `<Form.Field>` to intelligently identify if an input is explicitly marked as `.required()` in Zod to automatically append an asterisk (`*`) to the UI label.
- `FormFieldContext`: Initialized by `<Form.Field>` to broadcast the current field's `htmlId`, validation state (`error`, `isValidating`, `validationStatus`), and `required` boolean to its internal children.

If an internal input like `Form.Input` or `Form.Error` invokes `useFormField()` outside of a `<Form.Field>` parent wrapper, the app will instantly throw a unified `Error` to prevent silent misconfigurations.

## Extension & Custom Inputs

Developers looking to integrate 3rd-party libraries (e.g. Monaco Editor, a custom Drag-and-Drop file tool) into the form system should utilize `react-hook-form`'s `<Controller />` exported from `Form/index.js`. 

The general rule for creating new components within `shared/renderer/components/Form`:
1. Use `useFormField()` to extract the `htmlId` and `error` state.
2. Rely on `<Controller>` to bind the foreign input's `onChange` / `onBlur` events to the native hook-form state.
3. Delegate label and error bounding visually to `<Form.Field>`, avoiding hardcoding `<label>` tags directly inside the new component.
