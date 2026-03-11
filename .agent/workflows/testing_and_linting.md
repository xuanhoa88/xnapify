---
description: Run tests, benchmarks, and code quality checks
---

When the user requests to lint, fix, or thoroughly test the application, use these guidelines to properly run the project's quality checks.

### Running standard tests (Jest)
The project uses Jest with React Testing Library.

**To run the main suite:**
- Run `npm run test` to execute all unit and integration tests.
- To test a specific file, you can pass its path or part of its name: `npm run test -- <pattern>`
- Tests are typically suffixed with `.test.js` and live next to their corresponding source file or in a `__tests__` directory.

**To debug test failures:**
1. Check if the failure relates to missing mocks or context in React components, which usually require wrapping via `<Provider>` from `react-redux` or a custom mock.
2. Ensure you mock components correctly using standard Jest mocks `jest.mock('...')`.
3. Account for `@shared/` aliases in imports resolving natively by Jest config.

### Running benchmarks
The project has a separate benchmarking suite for performance-sensitive pathways.

**To run benchmarks:**
- Run `npm run benchmark` (or `node tools/run benchmark`).
- This executes all files named `*.benchmark.js` under `JEST_BENCHMARK=true` (disabling coverage).

**Writing benchmarks:**
Write benchmarks exactly like standard Jest `describe`/`it` blocks, but use `performance.now()` inside the block, and assert the duration is below a threshold or log out the results. Place them in `src/benchmarks/` or alongside the optimized file structure.

### Code Quality / Linting
The project strictly monitors JS & CSS code formatting.

**To check for style breaches:**
- Run `npm run lint` (Checks both JS and CSS files).
  - Alternative: `npm run lint:js` or `npm run lint:css`
- Check code formatting using Prettier by running `npm run format:check`.

**To automatically resolve issues:**
- Run `npm run fix` (Fixes both JS and CSS style infractions).
- Re-run `npm run format` to execute Prettier on the modified code.

**If the user reports a build failure:**
Always check linting output, as strict continuous integration (or husky pre-commit) might be causing failures due to standard style restrictions. Never ignore warning output silently; resolve them manually or via the fix scripts.
