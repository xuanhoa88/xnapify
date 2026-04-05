---
description: Start the planning process for a new feature, architecture design, or roadmap
---

When the user runs `/plan [task]`, follow these steps to execute the `architecture-planning` skill:

1. **Activate the Skill**
   Read the `architecture-planning` skill documentation at `.agent/skills/architecture-planning/SKILL.md` to understand the full workflow, including pre-creation scanning, scope challenging, and adversarial review.

2. **Run Pre-Creation Scan**
   Check for existing unfinished plans in the project (e.g., `src/apps/<module>/plans/`) that might overlap with the requested task. Ensure you mark any `blockedBy` or `blocks` dependencies in their frontmatter.

3. **Scope Challenge & Clarification**
   If the user's task is vague, ask clarifying questions before writing the plan. Suggest simplifications if the scope seems overly complex or violates YAGNI.

4. **Complexity Routing & Mode Selection**
   Based on the task description and your scan, select the planning mode:
   - **Fast Plan:** For tasks taking < 2 hours with limited architectural impact. Proceed with minimal overhead.
   - **Hard Plan:** For multi-day work, widespread architectural changes, or new integrations. This mode requires extensive documentation and architectural sign-offs.
   - **Standard Plan:** Default path.

5. **Approval Gate: Research Checkpoint (CRITICAL)**
   Before generating the final plan document, explicitly stop and share your high-level findings, strategy, and chosen mode with the user. **You MUST await their approval before writing the plan.**

6. **Generate the Architecture Plan**
   With user approval, design the solution (DB schema, APIs, Frontend), and save the comprehensive roadmap to the relevant module's `plans/` directory (`YYYY-MM-DD-<feature-name>.md`).

7. **Final Review and Handoff**
   Share the saved plan with the user for their final inspection. Highlight any unresolved questions or implementation risks. Suggest to use the `/build` workflow to proceed to execution.

**Important**: Do NOT write code during the `/plan` workflow. This workflow is exclusively for system design and architectural mapping.
