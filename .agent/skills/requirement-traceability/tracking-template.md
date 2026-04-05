# Traceability Map Template

**Use this template when:** Starting spec-driven implementation. Copy this template to your `task.md` artifact and fill in the actual spec sections/requirements.

**Purpose:** Track the bidirectional mapping between spec sections and code, ensuring nothing is missed and nothing unauthorized is added.

## Template

```markdown
# [Module/Feature Name] — Traceability Map

**Spec source (choose one):**
- Colocated: `src/apps/<module>/SPEC.md`
- Design: `src/apps/<module>/specs/YYYY-MM-DD-<topic>-design.md`

**Plan (if exists):** `src/apps/<module>/plans/YYYY-MM-DD-<topic>.md`
**Started:** YYYY-MM-DD
**Last updated:** YYYY-MM-DD

## Requirements Coverage

### For colocated SPEC.md:

| # | SPEC.md Section | Requirement Summary | Test File | Source File | Status |
|---|----------------|---------------------|-----------|-------------|--------|
| R1 | §1 Database | `User` model with `email`, `name` columns | `models/User.test.js` | `models/User.js` | ☐ |
| R2 | §2 API Routes | `POST /api/auth/login` — validates credentials, sets JWT | `controllers/auth.test.js` | `controllers/auth.controller.js` | ☐ |
| R3 | §2 API Routes | `POST /api/auth/register` — creates user, triggers email | `controllers/auth.test.js` | `controllers/auth.controller.js` | ☐ |
| R4 | §3 Frontend | `LoginForm.js` with SSR data fetching | `LoginForm.test.js` | `views/(default)/LoginForm.js` | ☐ |
| R5 | §4 Localization | Keys: `auth.login.failed`, `auth.password.reset_email_sent` | — | `translations/en-US.json` | ☐ |

### For design specs (new features):

| # | Spec Section | Requirement Summary | Plan Task | Test File | Source File | Status |
|---|-------------|---------------------|-----------|-----------|-------------|--------|
| R1 | §2.1 | Users can upload avatars | Task 3 | `avatar.controller.test.js` | `avatar.controller.js` | ☐ |
| R2 | §2.1 | Only JPEG/PNG/WebP accepted | Task 3 | `avatar.controller.test.js` | `validator/avatar.js` | ☐ |
| R3 | §2.2 | Avatars resize to 200×200 | Task 4 | `avatar.worker.test.js` | `avatar.worker.js` | ☐ |

## Status Legend

| Symbol | Meaning |
|--------|---------|
| ☐ | Not started |
| ◐ | In progress |
| ✅ | Done — code + test pass |
| ⚠️ | Amended — spec changed during implementation |
| ❌ | Blocked — needs human input |

## Amendments Log

Track all spec changes discovered during implementation.

| Date | SPEC.md Section | Original Text | Amended To | Reason | Approved By |
|------|----------------|---------------|------------|--------|-------------|
| — | — | — | — | — | — |

## Orphan Detection

### Code without spec sections
_List any code files that don't trace to a spec section above. These are candidates for deletion or spec update._

- (none found)

### Spec sections without code
_List any SPEC.md sections not covered above. These are incomplete implementations._

- (none found)

## Final Verification

- [ ] Every row has Status = ✅ or ⚠️ (amended)
- [ ] No orphan code exists
- [ ] No uncovered spec sections exist
- [ ] All amendments are approved
- [ ] SPEC.md reflects current implementation
- [ ] `npm test` passes
- [ ] `npm run lint` passes
```

## How to Use

1. **Before starting:** Copy this template to your `task.md` artifact
2. **Choose the right table:** Colocated SPEC.md or design spec
3. **Fill in sections:** Read the spec and list every section/requirement
4. **During implementation:** Update Status as you complete each item
5. **At the end:** Run the orphan detection and final verification sections
