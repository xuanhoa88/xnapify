# Test Extension AI Specification

> **Instructions for the AI:**
> Read this document to understand WHAT features to build inside `src/extensions/profile-plugin`.
> Read `.agent/rules.md` and `AGENT.md` to understand HOW to build them securely according to our architecture.

---

## Objective

[Describe the high-level business goal of the feature here. Example: "Add a testing dashboard for the admin panel."]

## 1. Database & Hooks (`/api` or `shared/extension` Logic)

_Define what data needs to be modified or hooked into._

- **Target Hook:** [e.g., `user.beforeCreate`]
- **Core Action:** [e.g., Inject a `"test_tier"` field with a default value of `"standard"`.]
- **Validation Rules:** [e.g., Must use `z.string()` from `@shared/validator`.]

## 2. Backend Routes (`/api`)

_Define any isolated endpoints this extension needs to expose._

- **Method & Path:** [e.g., `POST /api/extension/profile-plugin/ipc`]
- **Expected Payload:** [e.g., `{ targetId: z.string(), action: z.enum(['start', 'stop']) }`]
- **Security:** [e.g., Wrap route in `requireAuth` and `requirePermission('admin:test')`.]
- **Service Logic:** [Describe what the controller should actually do under the hood.]

## 3. Frontend Component & Slots (`/views`)

_Define exactly what UI you want generated._

- **Component Details:** [e.g., "Create a Functional Component named `TestDashboard.js`".]
- **Target Slot Injection:** [e.g., "Inject it into the `admin.settings.advanced` Slot via `reg.registerSlot()`".]
- **Styling Requirements:** [e.g., "Must use `TestDashboard.module.css` with a flexbox layout".]
- **Component State:** [e.g., "Needs a toggle switch that triggers a Redux action or an API `fetch()`." ]

## 4. Localization (`/translations`)

_Define the required languages and keys._

- **Locales Required:** [e.g., `en`, `vi`]
- **Mandatory Strings:** [e.g., "Execute Test", "Test Results", "Status: Running"]
- **Rule:** Do not hardcode these in JSX. They must be loaded via `i18n.t()`.

---

_Note: Once this file is filled out, ask the AI to **"Execute SPEC.md"**._
