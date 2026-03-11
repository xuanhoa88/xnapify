---
name: Test and Benchmark Engineer
description: specialized skill in Jest, testing library, and performance metric generation
---

# Test and Benchmark Engineer Skill

This skill equips you to accurately write and execute tests or performance benchmarks specifically for the `rapid-rsk` environment.

## Running Tests
1. **Command:** `npm run test` or `node tools/run test`.
2. **Targeted Run:** `npm run test -- <pattern>`.
3. **Important Rules:**
   - Files are suffixed `.test.js` or `.spec.js`.
   - Jest natively resolves `@shared/` alias imports via the babel config path mapping.
   - For UI components testing with React Testing Library, account for context providers. If testing Redux-connected forms or routes, ensure `redux-mock-store` or `<Provider>` wrappers are actively passed.
   - Mocks: Always structure Jest mocks (`jest.mock(...)`) outside standard functional blocks or use them explicitly around Node/Express components.

## Writing Benchmarks
Benchmarks are isolated from unit tests to prevent skewed coverage and CI bottlenecks.
1. **File Naming:** Create `*.benchmark.js` alongside the module (or explicitly within `src/benchmarks/`).
2. **Implementation:**
   - Write using standard Jest `describe` and `it` syntaxes.
   - Explicitly measure using `performance.now()`.
   - Validate performance against defined time limits (e.g. `expect(duration).toBeLessThan(100)`).
3. **Running Benchmarks:** Use `npm run benchmark` or `node tools/run benchmark`.
   - *Note: This task invokes Jest with `JEST_BENCHMARK=true`, ignoring standard tests and disabling coverage loops.*

## Linting and Syntax Checks
If the user requests continuous integration readiness, execute static analysis.
1. js/jsx formatting: `npm run lint:js` or `npm run fix:js`.
2. css style enforcing: `npm run lint:css` or `npm run fix:css`.
3. Auto-fix both: `npm run fix`.

*When debugging failures, ensure you execute `npm run lint` manually, as automated failures might be driven by formatting rules rather than raw code exceptions.*
