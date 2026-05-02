---
description: Intelligent implementation workflow with auto-routing based on intent
---

## Context
When executing the `/build` workflow, you are acting as an intelligent orchestrator to implement features based on the provided instructions. You must consistently respect user control by stopping and asking for their approval before making any definitive file changes.

## Process

1. **Analyze Demand:**
   - Understand what the user wants to build.
   - If the requirement is ambiguous or conflicts with existing architecture, stop and ask clarifying questions directly. Wait for the user response.

2. **Route Instruction:**
   Determine the best specialized workflow for the task:
   - Needs a new full-stack module? Use the steps from `/add-module`.
   - Just adding an endpoint? Use the steps from `/add-route`.
   - Extending the system? Use `/add-extension`.
   - If no specific workflow fits perfectly, formulate a custom step-by-step procedure based on project conventions.

3. **Approval Gate (CRITICAL):**
   - Present a brief outline of the intended steps.
   - You MUST stop and wait for explicit user approval before proceeding to code implementation. **Always ask**, do not bypass this check.

4. **Implement:**
   - Execute the steps in order.
   - Always ask for user approval at each step or file creation/modification.

5. **Verify:**
   - Run tests if applicable (e.g., using unit test scripts).

6. **Finalize:**
   - Give a short summary of the updates.
   - Suggest next steps involving `/recap` or `/commit`.
