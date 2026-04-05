---
description: Modify, upgrade, or maintain existing features, modules, or extensions with mandatory test verification
---

When modifying, upgrading, refactoring, or maintaining existing code (features, modules, extensions, shared libraries), follow this workflow to ensure nothing breaks.

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

All tests must pass. If any fail, investigate whether your change caused the regression.

## 6. Run Linting & Formatting

// turbo
Verify code style compliance:

```bash
npm run lint
```

If there are linting errors, fix them:

```bash
npm run fix
```

Check code formatting:

```bash
npm run format:check
```

Fix formatting if needed:

```bash
npm run format
```

## 7. Run Benchmarks (If Performance-Sensitive)

If your changes affect performance-sensitive code paths:

```bash
npm run test:benchmark
```

This executes all `*.benchmark.js` files under `JEST_BENCHMARK=true`. Place benchmarks alongside the optimized file or in `src/benchmarks/`.

## 8. Update or Add Tests

If your changes modified:

- **Public API** (function signatures, return types, new parameters) → Update existing tests
- **New behavior** (new code paths, edge cases) → Add new test cases
- **Bug fixes** → Add a regression test that would have caught the bug

Follow the testing patterns in `.agent/workflows/add-test.md`.

## 9. Post-Change Review

After all tests pass, consider running these skills for quality assurance:

- **`code-review` skill** — Validates architecture, conventions, and test coverage
- **`security-compliance` skill** — Audits for Zod validation, RBAC, and security compliance
- **`/audit-security` workflow** — Systematic grep-based security scan

## Summary Checklist

Before reporting the task as complete, confirm:

- [ ] Related tests identified
- [ ] Targeted tests pass after changes
- [ ] Full test suite passes (`npm test`)
- [ ] Linting passes (`npm run lint`)
- [ ] Formatting passes (`npm run format:check`)
- [ ] Benchmarks pass (if applicable)
- [ ] Tests updated/added if behavior changed

## Quick Command Reference

| Command                     | Purpose                            |
| --------------------------- | ---------------------------------- |
| `npm test`                  | Run all unit and integration tests |
| `npm run test -- <pattern>` | Run tests matching a pattern       |
| `npm run lint`              | Check JS and CSS lint rules        |
| `npm run lint:js`           | Check JS only                      |
| `npm run lint:css`          | Check CSS only                     |
| `npm run fix`               | Auto-fix lint issues               |
| `npm run format`            | Format code with Prettier          |
| `npm run format:check`      | Check formatting without modifying |
| `npm run test:benchmark`    | Run performance benchmarks         |

---

## See Also

- `/add-test` — Add new tests for changed code
- `/add-route` — Add a single API route to an existing module
- `/audit-security` — Run security audit on modified code
- `/commit` — Commit changes using Conventional Commits
- `/debug` — Diagnose build or runtime issues after changes
