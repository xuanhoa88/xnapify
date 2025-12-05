# Styling Guide

This guide covers styling in React Starter Kit using CSS Modules and PostCSS.

## 🎨 CSS Modules

### What are CSS Modules?

CSS Modules automatically scope CSS to components, preventing global namespace pollution.

### Basic Usage

```javascript
// Button.js
import useStyles from 'isomorphic-style-loader/useStyles';
import s from './Button.css';

function Button({ children }) {
  useStyles(s); // Required for SSR

  return <button className={s.button}>{children}</button>;
}
```

```css
/* Button.css */
.button {
  background: #007bff;
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
}

.button:hover {
  background: #0056b3;
}
```

**Generated HTML:**

```html
<button class="Button_button_1a2b3c">Click me</button>
```

### Multiple Classes

```javascript
<div className={`${s.container} ${s.active}`}>Content</div>;

// Or use classnames library
import clsx from 'clsx';

<div className={clsx(s.container, { [s.active]: isActive })}>Content</div>;
```

### Composition

```css
/* Base styles */
.button {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
}

/* Extend base button */
.primaryButton {
  composes: button;
  background: #007bff;
  color: white;
}

.secondaryButton {
  composes: button;
  background: #6c757d;
  color: white;
}
```

```javascript
<button className={s.primaryButton}>Primary</button>
<button className={s.secondaryButton}>Secondary</button>
```

## 🌍 Global Styles

### Global Classes

Use `:global` for global styles:

```css
/* App.css */
:global {
  body {
    margin: 0;
    font-family: Arial, sans-serif;
  }

  * {
    box-sizing: border-box;
  }
}

/* Or inline */
:global(.global-class) {
  color: red;
}
```

### Importing Global Styles

```javascript
// App.js
import 'normalize.css';
import './App.css';
```

## 📦 PostCSS Features

### Nesting

```css
.card {
  padding: 20px;

  & .title {
    font-size: 24px;
    margin: 0 0 10px;
  }

  & .content {
    color: #666;

    & p {
      margin: 0 0 10px;
    }
  }
}
```

### Custom Properties (CSS Variables)

```css
:root {
  --primary-color: #007bff;
  --secondary-color: #6c757d;
  --spacing-unit: 8px;
  --border-radius: 4px;
}

.button {
  background: var(--primary-color);
  padding: calc(var(--spacing-unit) * 2);
  border-radius: var(--border-radius);
}
```

### Autoprefixer

Vendor prefixes are added automatically:

```css
/* You write */
.box {
  display: flex;
  user-select: none;
}

/* Output includes */
.box {
  display: -webkit-box;
  display: -ms-flexbox;
  display: flex;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
}
```

### Custom Media Queries

```css
@custom-media --small-viewport (max-width: 576px);
@custom-media --medium-viewport (min-width: 577px) and (max-width: 992px);
@custom-media --large-viewport (min-width: 993px);

.container {
  padding: 20px;
}

@media (--small-viewport) {
  .container {
    padding: 10px;
  }
}

@media (--large-viewport) {
  .container {
    padding: 40px;
  }
}
```

## 📱 Responsive Design

### Mobile-First Approach

```css
/* Base styles (mobile) */
.container {
  padding: 10px;
  font-size: 14px;
}

/* Tablet */
@media (min-width: 768px) {
  .container {
    padding: 20px;
    font-size: 16px;
  }
}

/* Desktop */
@media (min-width: 1024px) {
  .container {
    padding: 40px;
    font-size: 18px;
  }
}
```

### Breakpoints

```css
/* Common breakpoints */
@media (max-width: 575px) {
  /* Mobile */
}
@media (min-width: 576px) and (max-width: 767px) {
  /* Small tablets */
}
@media (min-width: 768px) and (max-width: 991px) {
  /* Tablets */
}
@media (min-width: 992px) and (max-width: 1199px) {
  /* Small desktops */
}
@media (min-width: 1200px) {
  /* Large desktops */
}
```

## 🎯 Layout Patterns

### Flexbox Layout

```css
.container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.header {
  flex: 0 0 auto;
}

.main {
  flex: 1 0 auto;
}

.footer {
  flex: 0 0 auto;
}
```

### Grid Layout

```css
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
}

.sidebar {
  grid-column: 1 / 2;
}

.content {
  grid-column: 2 / -1;
}
```

### Centering

```css
/* Flexbox centering */
.center-flex {
  display: flex;
  justify-content: center;
  align-items: center;
}

/* Grid centering */
.center-grid {
  display: grid;
  place-items: center;
}

/* Absolute centering */
.center-absolute {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}
```

## 🎨 Theming

### CSS Variables Theme

```css
/* themes.css */
:root {
  --color-primary: #007bff;
  --color-secondary: #6c757d;
  --color-success: #28a745;
  --color-danger: #dc3545;
  --color-warning: #ffc107;
  --color-info: #17a2b8;

  --color-text: #212529;
  --color-text-muted: #6c757d;
  --color-bg: #ffffff;
  --color-bg-alt: #f8f9fa;

  --font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
    sans-serif;
  --font-size-base: 16px;
  --line-height-base: 1.5;

  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;

  --border-radius: 4px;
  --box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

/* Dark theme */
[data-theme='dark'] {
  --color-text: #f8f9fa;
  --color-text-muted: #adb5bd;
  --color-bg: #212529;
  --color-bg-alt: #343a40;
}
```

```javascript
// Toggle theme
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
}
```

## 🔤 Typography

### Font Families

```css
:root {
  --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-serif: Georgia, 'Times New Roman', serif;
  --font-mono: 'Courier New', Courier, monospace;
}

body {
  font-family: var(--font-sans);
}

code {
  font-family: var(--font-mono);
}
```

### Type Scale

```css
:root {
  --font-size-xs: 12px;
  --font-size-sm: 14px;
  --font-size-base: 16px;
  --font-size-lg: 18px;
  --font-size-xl: 20px;
  --font-size-2xl: 24px;
  --font-size-3xl: 30px;
  --font-size-4xl: 36px;
}

h1 {
  font-size: var(--font-size-4xl);
}
h2 {
  font-size: var(--font-size-3xl);
}
h3 {
  font-size: var(--font-size-2xl);
}
h4 {
  font-size: var(--font-size-xl);
}
h5 {
  font-size: var(--font-size-lg);
}
h6 {
  font-size: var(--font-size-base);
}
```

## 🎭 Animations

### Transitions

```css
.button {
  background: #007bff;
  transition: background 0.3s ease;
}

.button:hover {
  background: #0056b3;
}

/* Multiple properties */
.card {
  transform: translateY(0);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition:
    transform 0.3s ease,
    box-shadow 0.3s ease;
}

.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}
```

### Keyframe Animations

```css
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.fadeIn {
  animation: fadeIn 0.5s ease;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.spinner {
  animation: spin 1s linear infinite;
}
```

## 🖼️ Images

### Responsive Images

```css
.image {
  max-width: 100%;
  height: auto;
  display: block;
}

.cover {
  width: 100%;
  height: 300px;
  object-fit: cover;
}

.contain {
  width: 100%;
  height: 300px;
  object-fit: contain;
}
```

### Background Images

```css
.hero {
  background-image: url('/images/hero.jpg');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  height: 400px;
}

/* Responsive background */
@media (max-width: 768px) {
  .hero {
    background-image: url('/images/hero-mobile.jpg');
  }
}
```

## 🎨 Best Practices

### Organization

```css
/* 1. Layout */
.component {
  display: flex;
  position: relative;
}

/* 2. Box model */
.component {
  width: 100%;
  padding: 20px;
  margin: 0 auto;
}

/* 3. Typography */
.component {
  font-size: 16px;
  line-height: 1.5;
  color: #333;
}

/* 4. Visual */
.component {
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
}

/* 5. Misc */
.component {
  cursor: pointer;
  transition: all 0.3s ease;
}
```

### Naming Conventions

```css
/* BEM-style naming */
.card {
}
.card__title {
}
.card__content {
}
.card--featured {
}

/* Or simple descriptive names */
.card {
}
.cardTitle {
}
.cardContent {
}
.featuredCard {
}
```

### Performance

```css
/* Use transform instead of position */
/* ❌ Slow */
.box {
  position: relative;
  left: 100px;
}

/* ✅ Fast */
.box {
  transform: translateX(100px);
}

/* Avoid expensive properties */
/* ❌ Triggers reflow */
.box {
  width: 100px;
  height: 100px;
}

/* ✅ GPU accelerated */
.box {
  transform: scale(1);
  opacity: 1;
}
```

## 🔧 Configuration

### PostCSS Config

```javascript
// tools/postcss.config.js
module.exports = {
  plugins: [
    require('postcss-import'),
    require('postcss-nested'),
    require('postcss-custom-properties'),
    require('postcss-custom-media'),
    require('autoprefixer'),
  ],
};
```

### Browserslist

```
# .browserslistrc
> 1%
last 2 versions
not dead
```

## 📚 Resources

- [CSS Modules Documentation](https://github.com/css-modules/css-modules)
- [PostCSS Plugins](https://www.postcss.parts/)
- [MDN CSS Reference](https://developer.mozilla.org/en-US/docs/Web/CSS)
- [Can I Use](https://caniuse.com/) - Browser compatibility

## 📖 Next Steps

- **[Development Workflow](development.md)** - Development practices
- **[Component Guide](components.md)** - Building components
- **[Recipes](recipes/)** - Common styling patterns
