/**
 * Auto-discovered route: GET /api/settings/public
 * File: public/_route.js = /api/settings/public
 *
 * No auth required — exposes only settings marked is_public: true.
 */

import * as controller from '../../controllers/settings.controller';

// GET /api/settings/public (no auth)
export const get = controller.getPublic;
