---
name: coding-standards
description: Pragmatic coding standards for xnapify — concise, direct, no over-engineering, with project-specific conventions enforced
version: 3.0
priority: CRITICAL
---

# Clean Code — Pragmatic Standards

> **CRITICAL SKILL** — Be **concise, direct, and solution-focused**. The user wants working code, not a programming lesson.

> 🔴 **ABSOLUTE BAN:** You MUST NOT EVER generate code using optional chaining (`?.`), nullish coalescing (`??`), or nullish assignment (`??=`). The repository runs in an environment where these throw FATAL compilation/parsing errors. Use explicit logic (e.g., `x && x.y`). Under no circumstances is modern ES syntax permitted for guard clauses.

---

## Core Principles

| Principle     | Rule                                  |
| ------------- | ------------------------------------- |
| **SRP**       | Each function/class does ONE thing    |
| **DRY**       | Extract if duplicated 3+ times        |
| **KISS**      | Simplest solution that works          |
| **YAGNI**     | Don't build features nobody asked for |
| **Boy Scout** | Leave code cleaner than you found it  |
| **i18n**      | NO HARDCODED text. Use i18n always.   |

---

## Naming Conventions

| Element            | Convention           | Example                                          |
| ------------------ | -------------------- | ------------------------------------------------ |
| **Variables**      | Reveal intent        | `userCount`, not `n`                             |
| **Functions**      | Verb + noun          | `getUserById()`, not `user()`                    |
| **Booleans**       | Question form        | `isActive`, `hasPermission`, `canEdit`           |
| **Constants**      | SCREAMING_SNAKE      | `MAX_RETRY_COUNT`, `CACHE_TTL`                   |
| **Unused params**  | Prefix with `_`      | `(_req, res)` — ESLint `argsIgnorePattern: '^_'` |
| **Slice names**    | Scoped namespace     | `@admin/posts`, not `posts`                      |
| **Test describes** | `[context] filename` | `[admin/posts] slice.js`                         |

> **Rule:** If you need a comment to explain a name, rename it.

---

## Function Rules

| Rule                     | Guideline                                                                           |
| ------------------------ | ----------------------------------------------------------------------------------- |
| **Small**                | Max ~20 lines, ideally 5–10                                                         |
| **One Thing**            | Does one thing, does it well                                                        |
| **One Level**            | One level of abstraction per function                                               |
| **Few Args**             | Max 3 positional args. 4+ → use an options object: `fn(id, { models, cache, cwd })` |
| **No Side Effects**      | Don't mutate inputs unexpectedly                                                    |
| **Guard Clauses**        | Early returns for edge cases — flatten control flow                                 |
| **Max 2 nesting levels** | If deeper → extract a function                                                      |

---

## Syntax Restrictions

These are enforced by ESLint and **will fail lint**. Never use them:

| ❌ Banned                  | Why                            | ✅ Use Instead                                                             |
| -------------------------- | ------------------------------ | -------------------------------------------------------------------------- |
| `??` (nullish coalescing)  | Explicit ESLint config ban     | `x != null ? x : fallback` or `x \|\| fallback`                            |
| `??=` (nullish assignment) | Explicit ESLint config ban     | `if (x == null) x = value`                                                 |
| `?.` (optional chaining)   | Explicit ESLint config ban     | `x && x.prop` or guard clause                                              |
| `__dangle` property access | ESLint `no-underscore-dangle`  | Rename, or add `// eslint-disable-line no-underscore-dangle` in tests only |
| `node:` import prefix      | Fix compatibility for Node 16+ | Direct import (e.g. `import fs from 'fs'`)                                 |
| Global `fetch()` (backend) | Missing natively in Node 16    | Use `node-fetch`, `axios`, or injected `extra.fetch`                       |
| `structuredClone()`        | Missing natively in Node 16    | Use `lodash/cloneDeep`                                                     |
| `Array.prototype.at()`     | Added mid-lifecycle in v16.6   | Bracket notation: `arr[arr.length - 1]`                                    |
| `Object.hasOwn()`          | Added mid-lifecycle in v16.9   | `Object.prototype.hasOwnProperty.call(obj, prop)`                          |
| `node:test` runner imports | Missing natively in Node 16    | Use `jest` testing framework                                               |

---

## Import Order

ESLint enforces strict import grouping with blank lines between groups. The order is:

```
1. Built-in modules (fs, path, util)

2. External packages (react, lodash, express)

3. Internal aliases (@shared/...)

4. Parent imports (../)

5. Sibling imports (./)

6. Style imports (*.css — always last)
```

Within each group: **alphabetical** (case-insensitive). Prettier + ESLint auto-fix handles this:

```bash
npm run fix   # Auto-fix import order
```

---

## File Organization

### Backend Files

```
controllers/  → HTTP handlers (thin — delegate to services)
services/     → Business logic (testable, no req/res)
  *.helpers.js → Shared utilities for the service (DRY extraction)
  *.workers.js → Queue-based background job handlers
models/       → Sequelize model definitions
database/
  migrations/ → Schema changes
  seeds/      → Seed data
workers/      → Worker functions (direct calls, same-process)
routes/       → Express route definitions (_route.js files)
validator/    → Zod schemas
```

### Frontend Files

```
redux/
  index.js    → Public barrel export (thunks, selectors, actions, SLICE_NAME)
  slice.js    → Redux Toolkit slice (state, reducers, extraReducers)
  thunks.js   → createAsyncThunk definitions
  selector.js → State selectors using SLICE_NAME
ComponentName.js → React component
ComponentName.css → CSS Module
_route.js     → Route lifecycle hooks
```

### Key Patterns

| Pattern                  | Where                          | How                                                                           |
| ------------------------ | ------------------------------ | ----------------------------------------------------------------------------- |
| **Controller → Service** | `controller.js` → `service.js` | Controller resolves DI, validates input, calls service, sends response        |
| **Service dependencies** | Service functions              | Pass as options object: `fn(id, { models, cache, cwd })` — never import `app` |
| **Shared helpers**       | `*.helpers.js`                 | Extract when used by 2+ service functions                                     |
| **Error classes**        | `*.helpers.js`                 | Factory methods: `ExtensionError.notFound()`, `.conflict()`                   |

---

## Controller Pattern

Controllers are thin HTTP adapters. They resolve DI, validate, call service, respond:

```javascript
export const listItems = async (req, res) => {
  const container = req.app.get('container');
  const http = container.resolve('http');
  try {
    const items = await itemService.listItems({
      models: container.resolve('models'),
      cache: container.resolve('cache'),
    });
    return http.sendSuccess(res, { items });
  } catch (err) {
    return http.sendServerError(res, 'Failed to list items', err);
  }
};
```

| ✅ Do                                                | ❌ Don't                                   |
| ---------------------------------------------------- | ------------------------------------------ |
| Resolve DI from `req.app.get('container')`           | Import `app` or singletons directly        |
| Validate with `validateForm(() => schema, req.body)` | Access raw `req.body` without validation   |
| Return `http.sendSuccess` / `http.sendServerError`   | Use `res.json()` / `res.status()` directly |
| Delegate logic to service                            | Put business logic in controller           |

---

## Error Handling

| Layer                   | Pattern                                                        | Anti-pattern                           |
| ----------------------- | -------------------------------------------------------------- | -------------------------------------- |
| **Controller**          | `try/catch` → `http.sendServerError(res, msg, err)`            | Throwing without Express error handler |
| **Service**             | Let errors bubble up. Use custom error classes with `.status`. | Silent `catch {}` that swallows errors |
| **Worker (queue)**      | Log + re-throw so queue marks job failed                       | `catch {}` that reports success        |
| **Worker (function)**   | Let error propagate to caller                                  | Wrapping in unnecessary `try/catch`    |
| **Extension lifecycle** | `try/catch` in `install()` / `uninstall()`                     | Unguarded DB ops in state transitions  |
| **Frontend thunks**     | `rejectWithValue(error.message)`                               | `return undefined` on error            |

---

## React Component Rules

| Rule                   | Guideline                                                                   |
| ---------------------- | --------------------------------------------------------------------------- |
| **CSS Modules**        | `import s from './Component.css'` — classes via `s.className`               |
| **No inline styles**   | 🔴 ABSOLUTE BAN on `style={{...}}`. Use Radix props (`p`, `width`) or standard `.css` modules. Only valid exception: `style={{ display: 'none' }}` for hidden inputs or programmatic conditional animations. |
| **useCallback**        | Wrap event handlers passed as props                                         |
| **useMemo**            | Expensive derived data (filtering, counting)                                |
| **useRef for timers**  | Store timeout/interval IDs in refs, clean up in `useEffect` return          |
| **Cleanup on unmount** | Clear timers, abort controllers, unsubscribe listeners                      |
| **i18n**               | `t('namespace:key', 'Default fallback')` — always include a fallback        |
| **Forms**              | Always use `@shared/renderer/components/Form` tightly coupled to `react-hook-form` instead of raw `<input>` elements |
| **Permissions**        | `const { hasPermission } = useRbac()` — guard UI actions                    |
| **WebSocket**          | `useWebSocket()` hook — `ws.on('channel', handler)` with cleanup `ws.off()` |

---

## Comments Policy

| ✅ Useful Comments                                       | ❌ Delete These                            |
| -------------------------------------------------------- | ------------------------------------------ |
| JSDoc on exported functions: params, return, throws      | `// Get user by ID` above `getUserById()`  |
| `@route GET /api/posts` on controllers                   | `// Import express` above `import express` |
| Non-obvious business logic: _why_, not _what_            | `// Loop through array`                    |
| License header (first 6 lines of each file)              | `// Set loading to true`                   |
| `// eslint-disable-line` when needed in tests            | `// TODO: refactor later` without ticket   |
| Section separators: `// ========` blocks for large files | Comments explaining obvious guard clauses  |

---

## Anti-Patterns

| ❌ Pattern                           | ✅ Fix                                      |
| ------------------------------------ | ------------------------------------------- |
| Helper for a one-liner               | Inline the code                             |
| Factory for 2 objects                | Direct instantiation                        |
| `utils.js` with 1 function           | Put code where it's used                    |
| Deep nesting (3+ levels)             | Guard clauses + extract function            |
| Magic numbers                        | Named constants: `const CACHE_TTL = 60_000` |
| God functions (50+ lines)            | Split by responsibility                     |
| `import X from '@apps/other-module'` | `container.resolve()` or hook system        |
| `res.json({ data })`                 | `http.sendSuccess(res, { data })`           |
| `process.env.MY_VAR`                 | `process.env.XNAPIFY_MY_VAR`                |
| `require.context(\`${dynamic}\`)`    | Static string literal only                  |
| Boolean trap: `fn(true, false)`      | Options object: `fn({ isActive: true })`    |
| Callback-based code                  | Promisify: `const fn = promisify(cb)`       |

---

## 🔴 Before Editing ANY File (THINK FIRST!)

| Question                        | Why                | How to Check                                |
| ------------------------------- | ------------------ | ------------------------------------------- |
| **What imports this file?**     | They might break   | `grep -r "import.*from.*'./thisFile'" src/` |
| **What does this file import?** | Interface changes  | Read the import block                       |
| **What tests cover this?**      | Tests might fail   | Look for `thisFile.test.js` next to it      |
| **Is this shared code?**        | Multiple consumers | Is it in `shared/` or used by 2+ modules?   |

> 🔴 **Rule:** Edit the file + all dependent files in the SAME task.
> 🔴 **Never leave broken imports or missing updates.**

---

## 🔴 Self-Check Before Completing (MANDATORY)

| Check                           | Question                                                       |
| ------------------------------- | -------------------------------------------------------------- |
| ✅ **Goal met?**                | Did I do exactly what user asked?                              |
| ✅ **Files edited?**            | Did I modify all necessary files (imports, tests, dependents)? |
| ✅ **Code works?**              | Did I test or verify the change?                               |
| ✅ **No syntax restrictions?**  | No `??`, `?.`, `??=` in code?                                  |
| ✅ **No cross-domain imports?** | No `@apps/other-module` imports?                               |
| ✅ **DI used correctly?**       | Services resolved from container, not imported?                |
| ✅ **Nothing forgotten?**       | Any edge cases or null guards missed?                          |

> 🔴 **Rule:** If ANY check fails, fix it before completing.

---

## Verification Commands

```bash
npm run lint          # Check JS + CSS lint rules
npm run fix           # Auto-fix lint issues
npm run format:check  # Check Prettier formatting
npm run format        # Auto-fix formatting
npm test              # Run all tests
npm run test -- <pat> # Run tests matching a pattern
node .agent/skills/coding-standards/scripts/syntaxCheck.js     # Enforce syntax restrictions
node .agent/skills/coding-standards/scripts/namingCheck.js      # Enforce camelCase file naming
```

> 🔴 **Rule:** Never mark a task complete with failing lint or tests.

---

## Additional Patterns

### Worker Barrel Pattern

```javascript
// Tier 1 (DI-dependent — direct call):
// api/workers/index.js
import doTaskWorker from './task.worker';

export async function doTask(data) {
  return await doTaskWorker(data);
}

// Tier 2 (CPU-bound — thread pool):
// api/workers/index.js
export async function heavyCompute(container, input) {
  const worker = container.resolve('worker');
  return await worker.run('compute', 'heavyCompute', { input });
}
```

### Service Error Classes

```javascript
// api/services/errors.js
class XxxError extends Error {
  constructor(message, code, statusCode) {
    super(message);
    this.name = 'XxxError';
    this.code = code || 'XXX_ERROR';
    this.statusCode = statusCode || 500;
  }
  static notFound(msg) {
    return new XxxError(msg || 'Not found', 'NOT_FOUND', 404);
  }
  static conflict(msg) {
    return new XxxError(msg || 'Conflict', 'CONFLICT', 409);
  }
  static forbidden(msg) {
    return new XxxError(msg || 'Forbidden', 'FORBIDDEN', 403);
  }
}
```

### Sequelize Model Pattern

```javascript
// api/models/User.js
export default function defineModel({ connection, DataTypes }) {
  const User = connection.define(
    'User',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      email: { type: DataTypes.STRING, allowNull: false, unique: true },
      name: { type: DataTypes.STRING(255), allowNull: false },
    },
    {
      tableName: 'users',
      timestamps: true,
    },
  );

  User.associate = models => {
    User.hasMany(models.Post, { as: 'posts', foreignKey: 'userId' });
  };

  return User;
}
```

### CSS Module Composition

```css
/* Components compose from shared styles via composes: */
.button {
  composes: baseButton from '../shared/buttons.css';
  background-color: var(--color-primary);
}
```

> Remember: Always use `import s from './Component.css'` and `className={s.xxx}`. Never use inline styles or global class names.

---

## Related Skills & Workflows

| Need                   | Skill / Workflow              |
| ---------------------- | ----------------------------- |
| Module architecture    | `module-development` skill    |
| Extension architecture | `extension-development` skill |
| Security compliance    | `security-compliance` skill   |
| Code review            | `code-review` skill           |
| Database patterns      | `database-development` skill  |
| Engine patterns        | `engine-development` skill    |
| i18n strings           | `i18n-localization` skill     |
