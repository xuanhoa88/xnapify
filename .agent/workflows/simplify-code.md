---
description: Simplify and refactor code for clarity and robustness
---

# Simplify Code Logic

Use this workflow to refactor and simplify complex code logic, improving both readability and robustness.

## 1. Understand and Analyze Existing Logic
- Review the code to understand its current behavior, edge cases, and dependencies.
- Identify areas of excessive complexity such as deep nesting, long functions, duplicate code, or confusing variable names.

## 2. Ensure Test Coverage (Crucial for Robustness)
- Before changing any logic, run the existing unit tests to establish a baseline:
  `npm run test -- <Path_To_Test_File>`
- If tests are missing or insufficient, write new tests that cover the current behavior so you have a safety net during refactoring. This is the most critical step for maintaining robustness.

## 3. Apply Refactoring Techniques
- **Extract Functions:** Break down long, complex functions into smaller, single-responsibility helper functions.
- **Simplify Conditionals:** Flatten nested `if/else` blocks by using early returns (guard clauses).
- **Remove Duplication (DRY):** Consolidate repeated logic into shared utilities or custom hooks.
- **Improve Naming:** Rename variables and functions to clearly reflect their exact purpose.

## 4. Verify Correctness
- Run the tests again to ensure no regressions were introduced during the simplification process.
- Verify the application still builds and runs correctly without errors under `npm run dev`.

## 5. Review and Lint
- Run the project's linter and formatters to maintain code style consistency:
  `npm run lint`
