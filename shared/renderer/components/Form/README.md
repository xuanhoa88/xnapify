# 🎛 Form Components

A highly opinionated, accessible, and robust form system for xnapify, powered by `react-hook-form`, `Zod` validation, and Radix UI.

## Features

- **Zero Boilerplate Validation**: Pass a Zod schema to the root form; error tracking and UI manifestations are fully automatic.
- **Auto-wiring**: Form labels seamlessly append `*` styling if the underlying Zod schema flags a field as required.
- **Async Validations**: Built-in debounced async validation tracking (perfect for "Unique Username" or "Valid Domain" checks) that naturally sync with the UI.
- **Comprehensive API**: Supports primitive text/number fields out of the box, extending all the way to complex WYSIWYG editors and deep JSON trees.

## Library Support

Exported directly from `Form`:

- `Input` - Standard text, email, URL inputs
- `Password` - Hidden togglable inputs
- `Number` - Numeric enforcement
- `Textarea` - Multi-line strings
- `Checkbox` / `CheckboxList` - Boolean & Array sets
- `Radio` - Singular option selectors
- `Select` / `SearchableSelect` - Dropdowns mapped to collections
- `Switch` - Minimalist booleans
- `Date` / `DateRange` - Calendar integrations
- `FileUpload` - Drag-and-drop integrated uploader
- `WYSIWYG` - Rich content editor
- `Json` - Collapsible, natively interactive schema builder
- `InputMask` - Formatted masking (e.g. `+1 (___) - ___`)

## Quick Start

```jsx
import { Form } from '@shared/components/Form';
import { z } from '@shared/validator';

// 1. Define your Zod validator (the system auto-extracts translation rules here)
const schema = ({ z, i18n }) =>
  z.object({
    email: z.string().email(),
    password: z.string().min(8),
    rememberMe: z.boolean().default(false),
  });

export default function LoginView() {
  const handleSubmit = async (data, hookFormMethods) => {
    console.log('Passed Validation!', data.email);
  };

  return (
    <Form schema={schema} onSubmit={handleSubmit} defaultValues={{ email: '' }}>
      {/* 
        Form.Field automatically pairs the <label> with the input ID 
        and extracts required/error styling natively from the schema.
      */}
      <Form.Field name='email' label='Email Address'>
        <Form.Input type='email' placeholder='john@example.com' />
      </Form.Field>

      <Form.Field name='password' label='Password'>
        <Form.Password />
      </Form.Field>

      <Form.Field name='rememberMe'>
        <Form.Checkbox label='Keep me logged in' />
      </Form.Field>

      <button type='submit'>Deploy</button>
    </Form>
  );
}
```

## Creating Custom Fields

If you are expanding the `Form` components, all custom inputs **must** be nested under `<Form.Field>` when rendered, and should leverage `useFormField` to guarantee cohesive layout matching.

```javascript
import { Controller, useFormField } from '@shared/components/Form';

export default function MyCustomSlider({ name }) {
  // Extracts ID and bounds it safely
  const { htmlId, required, error } = useFormField();

  return (
    <Controller
      name={name}
      render={({ field }) => (
        <input
          id={htmlId}
          type='range'
          disabled={error}
          required={required}
          onChange={field.onChange}
        />
      )}
    />
  );
}
```

---

# Form Architecture Specification

## Overview

The `Form` component system in xnapify is a highly composed abstraction built on top of [react-hook-form](https://react-hook-form.com/) and [Zod](https://zod.dev/). It leverages Radix UI primitives for its visual foundation and strictly encapsulates all state management, validation flows, and accessibility standardizations internally.

The architecture is designed to enforce a single source of truth for validation schemas (via Zod), eliminate boilerplate from implementing common and complex inputs (like WYSIWYG or interactive JSON trees), and guarantee a unified design language across all modules.

## Architecture & Lifecycles

### Core Boundaries

1. **`<Form>`**: Acts as the ultimate provider wrapper. It initializes `react-hook-form`'s `useForm`, accepts the validation `schema`, manages the submission event wrapper, and syndicates its context down via `FormProvider` (from react-hook-form) and `FormValidationContext` (internal).
2. **`<Form.Field>`**: The mandatory structural shell for _any_ input element. It controls the grid layout, pairs `<label>` tags with their matching input IDs, and automatically parses validation states to inject them into the child input (e.g. coloring the input red on failure).
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
