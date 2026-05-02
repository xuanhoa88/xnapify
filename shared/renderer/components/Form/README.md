# 🎛 Form Components

A highly opinionated, accessible, and robust form system for xnapify, powered by `react-hook-form`, `Zod` validation, and Radix UI.

## Features

- **Zero Boilerplate Validation**: Pass a Zod schema to the root form; error tracking and UI manifestations are fully automatic.
- **Auto-wiring**: Form labels seamlessly append `*` styling if the underlying Zod schema flags a field as required.
- **Async Validations**: Built-in debounced async validation tracking (perfect for "Unique Username" or "Valid Domain" checks) that naturally sync with the UI.
- **Comprehensive API**: Supports primitive text/number fields out of the box, extending all the way to complex WYSIWYG editors and deep JSON trees.

## Library Support

Exported directly from `Form`:
* `Input` - Standard text, email, URL inputs
* `Password` - Hidden togglable inputs
* `Number` - Numeric enforcement
* `Textarea` - Multi-line strings
* `Checkbox` / `CheckboxList` - Boolean & Array sets
* `Radio` - Singular option selectors
* `Select` / `SearchableSelect` - Dropdowns mapped to collections
* `Switch` - Minimalist booleans
* `Date` / `DateRange` - Calendar integrations
* `FileUpload` - Drag-and-drop integrated uploader
* `WYSIWYG` - Rich content editor
* `Json` - Collapsible, natively interactive schema builder
* `InputMask` - Formatted masking (e.g. `+1 (___) - ___`)

## Quick Start

```jsx
import { Form } from '@shared/components/Form';
import { z } from '@shared/validator';

// 1. Define your Zod validator (the system auto-extracts translation rules here)
const schema = ({ z, i18n }) => z.object({
  email: z.string().email(),
  password: z.string().min(8),
  rememberMe: z.boolean().default(false)
});

export default function LoginView() {
  const handleSubmit = async (data, hookFormMethods) => {
    console.log("Passed Validation!", data.email);
  };

  return (
    <Form schema={schema} onSubmit={handleSubmit} defaultValues={{ email: '' }}>
      {/* 
        Form.Field automatically pairs the <label> with the input ID 
        and extracts required/error styling natively from the schema.
      */}
      <Form.Field name="email" label="Email Address">
        <Form.Input type="email" placeholder="john@example.com" />
      </Form.Field>

      <Form.Field name="password" label="Password">
        <Form.Password />
      </Form.Field>

      <Form.Field name="rememberMe">
        <Form.Checkbox label="Keep me logged in" />
      </Form.Field>

      <button type="submit">Deploy</button>
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
          type="range"
          disabled={error}
          required={required}
          onChange={field.onChange} 
        />
      )}
    />
  );
}
```
