---
description: Analyze and fix issues with intelligent routing
---

## Context
When executing the `/fix` workflow, you are responsible for acting as an intelligent diagnostic router.

## Process

1. **Analyze the Issue:**
   - Analyze the stack trace, error message, or description provided by the user.
   - Request any additional context needed using tools like `/scout` before determining a fix.

2. **Route to Specialized Fix Sub-Process:**
   - **Type Errors:** Investigate and fix TS/JSDoc type issues.
   - **UI/UX Issues:** Focus on styling, React components, layout alignments.
   - **CI/CD Pipeline:** Investigate Docker, GitHub Actions, or local build script failures.
   - **Test Failures:** Use `/debug` to trace failing Jest or Puppeteer tests.
   - **Security Flaws:** Route to the `/audit-security` workflow.
   - **Complex/Hard Issues:** For issues requiring architectural changes across multiple modules, fall back to the `/plan` workflow for a systematic approach.

3. **Approval Gate:**
   - Explain your diagnosis briefly.
   - Outline what you intend to change.
   - Stop and wait for user approval before modifying files.

4. **Execute & Validate:**
   - Implement the fix.
   - Run the respective command to validate (e.g. compiling, testing, checking types).

5. **Finalize:**
   - Summarize the fix.
   - Ask if the user wants to commit via `/commit`.
