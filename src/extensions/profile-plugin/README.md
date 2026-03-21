# Test Extension AI Instructions

This folder (`src/extensions/profile-plugin/`) is an isolated **Extension**.

**INHERITANCE NOTICE**: All global AI rules from `.agent/rules.md` and the architecture from `AGENT.md` strictly apply here.

## Local Extension Constraints

1. **Zero Core Coupling:** Do not `import` from `@apps/*`.
2. **Hook Injections Only:** Do not use regular React-Router routing. Register URLs and Views via `@shared/extension/client` using `reg.registerSlot(...)`.
3. **Database Isolation:** Any DB changes must be done via Extension Hooks (`reg.registerHook`).
4. **Translations:** All strings MUST use `i18n.t()` loading from `./translations`.
5. **No Global CSS:** Use locally scoped CSS Modules (`[Component].module.css`).

Always prioritize these local boundary constraints over any generalized advice.
