---
description: Simplify and refine code for clarity and maintainability without altering architecture
---

## Context
When executing the `/refactor` workflow, your goal is to reduce complexity in existing functionality.

## Principles
- **YAGNI, KISS, DRY**: Reduce abstractions, eliminate duplicate logic.
- **Preserve Functionality**: Do NOT change the behavior or API surface of the code.
- **Token Efficiency**: Remove unneeded descriptions.

## Simplification Rules
1. Reduce unnecessary nesting — prefer early returns and guard clauses over deep `if/else` ladders.
2. Eliminate redundant code and abstractions.
3. Consolidate related logic that is arbitrarily split.
4. Remove comments that describe obvious code.
5. Emphasize clarity over extreme brevity (explicit is better than implicitly compact).

## Process
1. **Identify Scope**: Using the path provided by the user, investigate the file(s).
2. **Analyze**: Find opportunities mapped to the simplification rules above.
3. **Refine Output**: Update the code file.
4. **Verify**: Check for syntax errors and suggest to run `/test-e2e` or unit tests to confirm the refactor didn't break functionality.
