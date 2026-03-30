---
description: Create a new functional React component with CSS Modules and PropTypes
---

When the user asks to create a new React component or UI element, enforce the following patterns based on the xnapify architecture.

### Component Structure

1. **Functional Components**: Always write functional components using React Hooks (`useState`, `useEffect`, etc.). Do not use class components.
2. **File Naming**: Use `PascalCase` for the `.js` component file and `PascalCase.module.css` for its stylesheet.
3. **Props and Validation**: Always define `propTypes` using the `prop-types` package.

#### Example Component Template

```javascript
import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import clsx from 'clsx';
// Use aliased imports where possible, e.g., @shared/renderer/components/...
import s from './MyComponent.module.css';

function MyComponent({ title, children, className }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    // Side effects here (data fetching, listeners)
    return () => {
      // Cleanup if necessary
    };
  }, []);

  return (
    <div className={clsx(s.container, className)}>
      <h2 className={s.title}>{title}</h2>
      <div className={s.content}>{children}</div>
    </div>
  );
}

MyComponent.propTypes = {
  title: PropTypes.string.isRequired,
  children: PropTypes.node,
  className: PropTypes.string,
};

export default MyComponent;
```

### Styling Guidelines

1. **CSS Modules**: Always use CSS Modules. Import the styles as `import s from './Component.module.css';` (or `import styles from ...`).
2. **Applying Classes**: Apply multiple classes gracefully using the `clsx` package to map props/state to class names.
3. **Avoid Inline Styles**: Avoid defining `style={{ ... }}` objects directly unless styles are truly dynamic (e.g., coordinate calculations). Utilize CSS rules.

### Forms and Validation

If the component is a form, use `react-hook-form` integrated with validation through `zod`:

```javascript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from '@shared/validator';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

// Inside component:
const {
  register,
  handleSubmit,
  formState: { errors },
} = useForm({
  resolver: zodResolver(schema),
});
```

Keep your React components strictly focused on presentation and UI state. Business logic should rely heavily on custom hooks, async thunks, or backend services.
