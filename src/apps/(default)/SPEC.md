# Default Module AI Specification

> **Instructions for the AI:** 
> Read this document to understand the core features of the `(default)` module.
> This module handles the landing page experience, feature showcasing, and the admin dashboard.

---

## Objective
Provide a professional landing page for the application and a default admin dashboard entry point. This is the first module loaded (alphabetically) and serves as the public-facing home and the admin root.

## 1. Database Modifications (`api/models`)
*The (default) module does not own its own core models.*
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
*Note: This spec reflects the CURRENT implementation of the default module. Activity logging is handled by the separate `activities` module.*
