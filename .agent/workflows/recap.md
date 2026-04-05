---
description: Review recent changes and wrap up the work
---

## Context
When executing the `/recap` workflow, your role is to summarize what was recently done. 

**IMPORTANT**: **Do not** start implementing any new features.

## Process
1. **Analyze:** Check the current `git diff`, staging area, and most recent commits. Review the modified files using `/scout` patterns if necessary.
2. **Cross-reference:** Map the changes back against the existing implementation plan if one exists. Validate if all targets were hit.
3. **Generate Digest:** Provide a crisp formatting of changes:
   - What was added.
   - What was modified.
   - What was removed.
4. **Next Actions:** Suggest what the user should do next, for example:
   - `/commit`
   - `/plan` for the next sprint
   - `/build` for remaining incomplete features
