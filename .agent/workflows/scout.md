---
description: Fast codebase scouting using parallel agents
---

## Context
When executing the `/scout` workflow, your role is to perform fast, token-efficient codebase investigation to find files related to a specific feature or keyword before making architectural changes.

## When to Use
- Beginning work on a feature spanning multiple directories.
- Needing to locate specific functionality or understand how a feature is wired up.
- Starting a debugging session needing file relationship understanding.

## Process

1. **Target Analysis:**
   - Analyze the search intent (e.g., keywords, class names, directory namespaces).

2. **Parallel Scouting:**
   - Use your available tools (`grep_search`, `list_dir`) to search the codebase concurrently.
   - Aim to hit different patterns (e.g., `.js` source files, `.test.js` logic, configuration files).

3. **Consolidate Results:**
   - Group findings logically (e.g., by module, by directory, by file type).
   - Ignore irrelevant cache or build directories like `/node_modules`, `/.data`, or `/dist`.

4. **Final Report Format:**
   Provide a brief Markdown response with:
   - **Relevant Files:** Bullet list of paths and a brief note on what they do.
   - **Key Findings:** Notes on architectural patterns discovered.
   - **Unresolved Questions:** Any gaps in findings.

5. **Suggested Next Steps:**
   - Recommend invoking `/plan` or `/build` now that the context is gathered.
