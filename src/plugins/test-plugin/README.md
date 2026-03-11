# Test Plugin AI Instructions

This folder (`src/plugins/test-plugin/`) is an isolated **Plugin**.

**INHERITANCE NOTICE**: All global AI rules from `.agent/rules.md` and the architecture from `AGENT.md` strictly apply here. 

## Local Plugin Constraints
1. **Zero Core Coupling:** Do not `import` from `@apps/*`.
2. **Hook Injections Only:** Do not use regular React-Router routing. Register URLs and Views via `@shared/plugin/client` using `reg.registerSlot(...)`.
3. **Database Isolation:** Any DB changes must be done via Plugin Hooks (`reg.registerHook`).
4. **Translations:** All strings MUST use `i18n.t()` loading from `./translations`.
5. **No Global CSS:** Use locally scoped CSS Modules (`[Component].module.css`).

Always prioritize these local boundary constraints over any generalized advice.
