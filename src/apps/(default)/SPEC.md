# Default Module AI Specification

> **Instructions for the AI:** 
> Read this document to understand the core features of the `(default)` module.
> This module handles the landing page experience, feature showcasing, and administrative activity logging.

---

## Objective
Provide a professional landing page for the application while serving as the primary dashboard for monitoring system activities and news.

## 1. Database Modifications (`api/models`)
*The (default) module does not own its own core models but interacts with system-wide services.*
- **Activity Logging:** Uses shared logging infrastructure to track system-wide events.
- **News:** Static or dynamically fetched news items for the dashboard.

## 2. API Routes & Controllers (`api/`)
- **Method & Path:** `GET /api/news`
  - **Logic:** Fetches latest product news and updates.
- **Method & Path:** `GET /api/activities`
  - **Security:** Requires `activities:read` permission.
  - **Logic:** Paginated list of system activities with filtering by entity type and ID.
- **Method & Path:** `POST /api/activities/cleanup`
  - **Security:** Requires `admin` role.
  - **Logic:** Triggers background cleanup of old activity logs.
- **Method & Path:** `GET /api/activities/stats`
  - **Logic:** Returns aggregation of activities for dashboard charts.

## 3. Frontend SSR Rendering (`views/`)
- **Main Path:** `/` (Home)
  - **Components:** `Home.js`, `Features.js`, `Feedback.js`.
  - **Data:** `data.js` contains static feature highlights and testimonials.
- **Main Path:** `/features/:featureId`
  - **Component:** `FeatureDetails.js`.
  - **SSR Hook:** `getInitialProps` fetches specific feature data based on the route parameter.
- **Main Path:** `/contact`
  - **Component:** `Contact.js`.
  - **Logic:** Handles user inquiries and feedback submissions.
- **Admin Path:** `/admin/activities`
  - **Logic:** Admin-only view for monitoring the `Activity` log.

## 4. Localization (`translations/`)
- **Keys:** `home.hero.title`, `features.list.headline`, `contact.form.submit`.
- **Note:** All UI labels in the landing page must be wrapped in `i18n.t()` to support multi-language marketing.

---
*Note: This spec reflects the CURRENT implementation of the default module.*
