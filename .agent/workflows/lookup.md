---
description: Search library or framework documentation externally
---

## Context
When executing the `/lookup` workflow, you are required to fetch the most up-to-date documentation on a provided framework or library before making coding assumptions.

## Process
1. **Parse Request:** Understand which library or framework the user needs context for.
2. **Locate Documents:** 
   - Search the web for the official docs.
   - Whenever possible, try to prioritize reading the `llms.txt` or `llms-full.txt` (common pattern on modern frameworks like context7/llms implementation) to get a clean, LLM-optimized view of the library specifications.
3. **Synthesize Findings:**
   Create a brief markdown summary of your findings:
   - Direct answer to the user's implicit/explicit question.
   - Relevant code snippets highlighting correct usage based on the newest API versions.
   - Source URLs you fetched from.
4. **Next Steps:** Suggest executing `/plan` or `/build` now that the framework knowledge has been established.
