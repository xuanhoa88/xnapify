# Traceability Map Template

**Use this template when:** Starting spec-driven implementation. Copy this template to your `task.md` artifact and fill in the actual spec requirements.

**Purpose:** Track the bidirectional mapping between spec requirements and code, ensuring nothing is missed and nothing unauthorized is added.

## Template

```markdown
# [Feature Name] — Traceability Map

**Spec:** `docs/specs/YYYY-MM-DD-<topic>-design.md`
**Plan:** `docs/plans/YYYY-MM-DD-<topic>.md`
**Started:** YYYY-MM-DD
**Last updated:** YYYY-MM-DD

## Requirements Coverage

| # | Spec Section | Requirement Summary | Plan Task | Test File | Source File | Status |
|---|-------------|---------------------|-----------|-----------|-------------|--------|
| R1 | §2.1 | Users can upload avatars | Task 3 | `avatar.controller.test.js` | `avatar.controller.js` | ☐ |
| R2 | §2.1 | Only JPEG/PNG/WebP accepted | Task 3 | `avatar.controller.test.js` | `validator/avatar.js` | ☐ |
| R3 | §2.2 | Avatars resize to 200×200 | Task 4 | `avatar.worker.test.js` | `avatar.worker.js` | ☐ |
| R4 | §2.3 | Old avatar deleted on re-upload | Task 5 | `avatar.service.test.js` | `avatar.service.js` | ☐ |

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

| Date | Requirement | Original Spec | Amended To | Reason | Approved By |
|------|------------|---------------|------------|--------|-------------|
| — | — | — | — | — | — |

## Orphan Detection

### Code without spec requirements
_List any code files that don't trace to a requirement above. These are candidates for deletion._

- (none found)

### Spec requirements without code
_List any requirements from the spec not covered above. These are missing tasks._

- (none found)

## Final Verification

- [ ] Every row has Status = ✅ or ⚠️ (amended)
- [ ] No orphan code exists
- [ ] No uncovered spec requirements exist
- [ ] All amendments are approved
- [ ] `npm test` passes
- [ ] `npm run lint` passes
```

## How to Use

1. **Before starting:** Copy this template to your `task.md` artifact
2. **Fill in requirements:** Read the spec and list every requirement
3. **Map to plan tasks:** Connect each requirement to its plan task
4. **During implementation:** Update Status as you complete each requirement
5. **At the end:** Run the orphan detection and final verification sections
