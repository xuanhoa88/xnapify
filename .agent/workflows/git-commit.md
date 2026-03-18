---
description: Stage, commit, and push changes using Conventional Commits
---

When asked to commit, save progress, or push changes, follow this workflow.

## 1. Pre-Commit Checks

Before committing, verify the code is clean:

// turbo
```bash
npm test
```

// turbo
```bash
npm run lint
```

If tests or linting fail, fix them first. Do NOT commit broken code.

## 2. Review Changes

// turbo
```bash
git status
```

// turbo
```bash
git diff --stat
```

Review what will be committed. Group related changes into a single commit. If changes span unrelated features, split into multiple commits.

## 3. Stage Files

Stage only the files related to the current change:

```bash
git add <file1> <file2> ...
```

**Do NOT** blindly `git add .` — this risks committing unrelated files, build artifacts, or environment secrets.

**Never commit:** `.env`, `database.sqlite`, `node_modules/`, `build/`, `.DS_Store`

## 4. Write Commit Message

Use [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <short description>
```

**Types:**

| Type | Use When |
|---|---|
| `feat` | Adding new functionality |
| `fix` | Fixing a bug |
| `docs` | Documentation only |
| `refactor` | Code change without behavior change |
| `test` | Adding or updating tests |
| `chore` | Dependencies, configs, tooling |
| `style` | Formatting, whitespace (no logic change) |
| `perf` | Performance improvement |

**Scope** = module or area affected (optional but recommended):

```bash
# Examples
git commit -m "feat(users): add password reset endpoint"
git commit -m "fix(auth): handle expired refresh token"
git commit -m "refactor(webhook): simplify handler registration"
git commit -m "docs: update README with Docker instructions"
git commit -m "test(rbac): add permission edge case tests"
git commit -m "chore: upgrade sequelize to 6.38"
```

**Rules:**
- Subject line ≤ 72 characters
- Imperative mood ("add" not "added", "fix" not "fixed")
- No period at end
- Lowercase after type prefix

## 5. Create Branch (if on main)

// turbo
```bash
git branch --show-current
```

If currently on `main` or `master`, create a feature branch first:

```bash
git checkout -b <type>/<short-description>
```

**Branch naming:**
- `feat/password-reset`
- `fix/session-cookie-domain`
- `refactor/webhook-engine`
- `docs/update-readme`

## 6. Commit

```bash
git commit -m "<type>(<scope>): <description>"
```

## 7. Push (if requested)

```bash
git push origin <branch-name>
```

If this is the first push for the branch:

```bash
git push -u origin <branch-name>
```
