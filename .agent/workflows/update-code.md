---
description: Modify, upgrade, or maintain existing features, modules, or plugins with mandatory test verification
---

When modifying, upgrading, refactoring, or maintaining existing code (features, modules, plugins, shared libraries), follow this workflow to ensure nothing breaks.

## 1. Assess Impact

Before making changes, identify what will be affected:

- List all files you plan to modify
- Find related test files (`*.test.js`, `*.benchmark.js`) in the same directory or parent module
- Check for downstream consumers by grepping for imports of the changed files
- Review existing tests to understand current expected behavior

## 2. Run Existing Tests (Before Changes)

// turbo
Run the existing tests to establish a baseline:

```bash
npm run test -- <module-or-file-pattern>
```

If tests are already failing before your changes, note them separately so you don't confuse pre-existing failures with regressions you introduce.

## 3. Make Code Changes

Apply your modifications following the project's coding standards (see `AGENT.md`).

## 4. Run Targeted Tests (After Changes)

// turbo
Run the tests specific to the code you changed:

```bash
npm run test -- <module-or-file-pattern>
```

- If tests **fail**: fix the code or update the tests if behavior intentionally changed
- If tests **pass**: proceed to the next step
- **Do NOT skip this step.** Do NOT consider the task complete without passing tests.

## 5. Run Full Test Suite

// turbo
Run the complete test suite to catch cross-module regressions:

```bash
npm test
```

All 912+ tests must pass. If any fail, investigate whether your change caused the regression.

## 6. Run Linting

// turbo
Verify code style compliance:

```bash
npm run lint
```

If there are linting errors, fix them:

```bash
npm run fix
```

## 7. Update or Add Tests

If your changes modified:
- **Public API** (function signatures, return types, new parameters) → Update existing tests
- **New behavior** (new code paths, edge cases) → Add new test cases
- **Bug fixes** → Add a regression test that would have caught the bug

Follow the testing patterns in `.agent/workflows/add-tests.md`.

## Summary Checklist

Before reporting the task as complete, confirm:

- [ ] Related tests identified
- [ ] Targeted tests pass after changes
- [ ] Full test suite passes (`npm test`)
- [ ] Linting passes (`npm run lint`)
- [ ] Tests updated/added if behavior changed
