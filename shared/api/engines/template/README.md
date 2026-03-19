# Template Engine

LiquidJS-based template rendering for dynamic content. Used by the email engine for inline template processing and by modules for managed templates.

## Quick Start

```javascript
const template = app.get('container').resolve('template');

const html = await template.render('<p>Hello {{ name }}</p>', { name: 'World' });
// => '<p>Hello World</p>'
```

## API

### `template.render(templateString, data)`

Renders a LiquidJS template. Returns the rendered string. Errors are caught and logged — returns empty string on failure.

### `template.renderStrict(templateString, data)`

Same as `render` but throws on errors. Use for preview/validation scenarios.

### Custom Instances

```javascript
import { createFactory } from '@shared/api/engines/template';
const customTemplate = createFactory();
```

## See Also

- [SPEC.md](./SPEC.md) — Technical specification
