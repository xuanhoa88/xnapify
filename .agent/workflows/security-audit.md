---
description: Run a security audit across routes, controllers, extensions, and infrastructure
---

Run a systematic security audit using the `security-auditor` skill across target modules, extensions, or the full codebase.

> **Prerequisite:** Read the `security-auditor` skill (`view_file .agent/skills/security-auditor/SKILL.md`) before starting. It defines the 12 audit domains and severity levels.

## Quick Start

```bash
# Audit a specific module
/security-audit users

# Audit a specific extension
/security-audit oauth-google-plugin

# Audit all routes
/security-audit --routes

# Full codebase audit
/security-audit
```

---

## Step 1: Identify Scope

Determine what to audit based on the user's request.

### Audit a specific module

// turbo
```bash
find src/apps/{module}/api -name "_route.js" -o -name "*.controller.js" -o -name "*.service.js" | sort
```

### Audit a specific extension

// turbo
```bash
find src/extensions/{extension} -name "*.js" -not -path "*/node_modules/*" | sort
```

### Audit all API routes

// turbo
```bash
find src/apps src/extensions -name "_route.js" -not -path "*/node_modules/*" | sort
```

### Full codebase audit

// turbo
```bash
echo "=== API Routes ===" && find src/apps src/extensions -name "_route.js" -not -path "*/node_modules/*" | wc -l
echo "=== Controllers ===" && find src/apps src/extensions -name "*.controller.js" | wc -l
echo "=== Extensions ===" && ls -d src/extensions/*/ 2>/dev/null | wc -l
echo "=== Validators ===" && find src/apps src/extensions -path "*/validator/*.js" | wc -l
```

## Step 2: Input Validation Audit

Check every controller for Zod validation compliance.

// turbo
```bash
# Find controllers accessing req.body without validation
grep -rn "req\.body" src/apps/{module}/api/controllers/ --include="*.js" | grep -v "validateForm\|schema\.parse\|\.test\."
```

// turbo
```bash
# Find controllers accessing req.params without type coercion
grep -rn "req\.params\." src/apps/{module}/api/controllers/ --include="*.js" | grep -v "\.test\."
```

// turbo
```bash
# Find routes with validator imports to confirm coverage
grep -rn "from.*validator" src/apps/{module}/api/ --include="*.js" | grep -v "\.test\."
```

**Expected:** Every `req.body` access should have a corresponding `validateForm` or `schema.parse` call above it.

## Step 3: RBAC Route Protection Audit

Check every route file for permission guards.

// turbo
```bash
# Find route exports without requirePermission
grep -rn "export const \(get\|post\|put\|patch\|del\)" src/apps/{module}/api/routes/ --include="_route.js"
```

// turbo
```bash
# Check for unprotected admin routes
find src/apps/{module}/api/routes -path "*admin*/_route.js" -exec grep -L "requirePermission\|middleware" {} \;
```

**Expected:** All admin routes wrapped in `requirePermission()`. Public routes must export `export const middleware = false` with a documented reason.

## Step 4: Cross-Module Isolation Audit

// turbo
```bash
# Check for forbidden cross-module imports
grep -rn "from '@apps/" src/apps/{module}/ --include="*.js" | grep -v "\.test\." | grep -v "node_modules"
```

// turbo
```bash
# Check extensions for direct src/apps/ imports
grep -rn "from '.*src/apps" src/extensions/ --include="*.js" | grep -v "node_modules"
```

**Expected:** Zero results. All cross-module communication via DI `container.resolve()` or the hook system.

## Step 5: Environment Variable Audit

// turbo
```bash
# Find non-prefixed env vars (excluding standard ones)
grep -rn "process\.env\." src/apps/{module}/ src/extensions/ --include="*.js" | grep -v "NODE_ENV\|DEBUG\|PORT\|DATABASE_URL\|XNAPIFY_\|\.test\.\|node_modules"
```

// turbo
```bash
# Find hardcoded secrets (common patterns)
grep -rn "password.*=.*['\"]" src/apps/{module}/ --include="*.js" | grep -v "\.test\.\|\.env\|schema\|validation\|placeholder\|example"
```

**Expected:** All custom env vars use `XNAPIFY_` prefix. No hardcoded secrets.

## Step 6: SQL Safety Audit

// turbo
```bash
# Find raw SQL or string interpolation in queries
grep -rn "sequelize\.query\|\.literal(" src/apps/{module}/ --include="*.js" | grep -v "\.test\."
```

// turbo
```bash
# Find template literals near query contexts
grep -rn "sequelize\.\(query\|literal\)" src/apps/{module}/ --include="*.js" | grep '`'
```

**Expected:** No string interpolation with user input in SQL. Use parameter binding: `sequelize.query('SELECT ?', { replacements: [value] })`.

## Step 7: Path Traversal Audit

// turbo
```bash
# Find file operations with user input
grep -rn "path\.join\|path\.resolve\|fs\..*read\|fs\..*write\|fs\..*mkdir\|fs\..*rm" src/apps/{module}/ --include="*.js" | grep -v "\.test\.\|node_modules"
```

**Expected:** All file paths with user input validate against base directory using `path.relative()` guard.

## Step 8: Extension Security Audit

Only when auditing extensions:

// turbo
```bash
# Check for boot/shutdown symmetry
for ext in src/extensions/*/; do
  echo "--- $(basename $ext) ---"
  echo "  boot registrations:"
  grep -c "registerSlot\|registerHook\|\.on(" "$ext/views/index.js" "$ext/api/index.js" 2>/dev/null || echo "  0"
  echo "  shutdown cleanups:"
  grep -c "unregisterSlot\|unregisterHook\|\.off(" "$ext/views/index.js" "$ext/api/index.js" 2>/dev/null || echo "  0"
done
```

// turbo
```bash
# Check IPC handler uses __EXTENSION_ID__
grep -rn "registerHook.*ipc:" src/extensions/ --include="*.js" | grep -v "__EXTENSION_ID__"
```

**Expected:** Boot registration count equals shutdown cleanup count. IPC hooks always use `__EXTENSION_ID__`.

## Step 9: Rate Limiting Audit

// turbo
```bash
# Find static asset routes missing rate limit opt-out
find src/apps src/extensions -name "_route.js" -path "*/static*" -exec grep -L "useRateLimit" {} \;
```

// turbo
```bash
# Find auth routes that might need stricter limits
find src/apps -name "_route.js" -path "*auth*" -exec grep -L "useRateLimit" {} \;
```

## Step 10: Generate Report

After completing all steps, compile findings using the security-auditor skill report format:

```markdown
# Security Audit: [scope description]

## Summary
[1-2 sentence risk assessment]

## Findings

### Input Validation
- 🔴/🟡/✅ [file:line] Description. Fix: ...

### Route Protection (RBAC)
- 🔴/🟡/✅ [file:line] Description. Fix: ...

### Cross-Module Isolation
- 🔴/🟡/✅ Findings...

### Environment Variables
- 🔴/🟡/✅ Findings...

### SQL Safety
- 🔴/🟡/✅ Findings...

### Path Traversal
- 🔴/🟡/✅ Findings...

### Extension Security
- 🔴/🟡/✅ Findings...

### Rate Limiting
- 🔴/🟡/✅ Findings...

## Risk Level
**LOW** | **MEDIUM** | **HIGH** | **CRITICAL**

## Recommended Actions
1. [Prioritized fix list]
```

## Step 11: Follow Up

After the audit report is generated:

1. If any 🔴 CRITICAL findings → fix immediately using `/update-code` workflow
2. If 🟡 WARNING findings → create task items for remediation
3. Run the `code-reviewer` skill on any fixes before committing

---

## See Also

- `/update-code` — Apply fixes for audit findings with test verification
- `/add-module` — Module creation with built-in security patterns
- `/add-extension` — Extension creation with isolation guarantees
- `/git-commit` — Commit audit fixes using Conventional Commits
