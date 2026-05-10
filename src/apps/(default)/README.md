# Core Module AI Instructions

This folder (`src/apps/(default)/`) is a **Core Module**.

**INHERITANCE NOTICE**: All global AI rules from `.agent/rules.md` and the architecture from `AGENT.md` strictly apply here.

## Local Module Constraints

Unlike Extensions, Core Modules are fully woven into the backend architecture.

1. **Direct Imports Allowed**: You may import functions from other core modules if necessary, though using `@shared/` dependencies is still preferred.
2. **Schema Control**: You are allowed to create and export original Sequelize models in `api/models/`. You do not need to use Extension Hooks to alter the DB.
3. **Native Routing**: You must expose your API endpoints directly via `api/index.js` or `api/routes.js` using standard Express Routers. Do not use Slots or Hooks.
4. **Initial Props**: For frontend views (`views/`), utilize the `getInitialProps` lifecycle inside `_route.js` to handle data fetching before rendering.

Always prioritize these local boundary constraints when refactoring or building new features within this module.

---

# Default Module AI Specification

> **Instructions for the AI:**
> Read this document to understand the core features of the `(default)` module.
> This module handles the landing page experience, feature showcasing, and the admin dashboard.

---

## Objective

Provide a professional landing page for the application and a default admin dashboard entry point. This is the first module loaded (alphabetically) and serves as the public-facing home and the admin root.

## 1. Database Modifications (`api/models`)

_The (default) module does not own its own core models._

- This module is stateless and relies on other modules' data (e.g., news endpoints, dashboard widgets).

## 2. API Routes & Controllers (`api/`)

- **Method & Path:** `GET /api/news`
  - **Logic:** Fetches latest product news and updates for the dashboard and landing page.

## 3. Frontend SSR Rendering (`views/`)

### Public Views

- **Path:** `/` (Home)
  - **Components:** `Home.js`, `Features.js`, `Feedback.js`.
  - **Data:** `data.js` contains static feature highlights and testimonials.
- **Path:** `/features/:featureId`
  - **Component:** `FeatureDetails.js`.
  - **SSR Hook:** `getInitialProps` fetches specific feature data based on the route parameter.
- **Path:** `/contact`
  - **Component:** `Contact.js`.
  - **Logic:** Handles user inquiries and feedback submissions.
- **Path:** `/profile`
  - **Component:** `Profile.js`.
  - **Logic:** User profile editing page with extension slot support.

### Admin Views

- **Path:** `/admin` (Dashboard)
  - **Logic:** Admin landing page showing system overview, news, and quick actions.

## 4. Localization (`translations/`)

- **Keys:** `home.hero.title`, `features.list.headline`, `contact.form.submit`.
- **Note:** All UI labels in the landing page must be wrapped in `i18n.t()` to support multi-language marketing.

---

_Note: This spec reflects the CURRENT implementation of the default module. Activity logging is handled by the separate `activities` module._
