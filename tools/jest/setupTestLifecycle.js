/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Jest setup file that runs after the test environment is set up
 * but before each test file is executed.
 */

// jest/setupTestLifecycle.js
// ----------------------
// Runs after the environment has been set up but before any individual
// test file executes.  We use it to configure i18next (so components
// render without errors) and to wire up an in‑memory database that can
// be reused across tests.

import { setupTestDb, closeTestDb } from './setupTestDb.js';
import { initI18nForTesting } from './setupTestI18n.js';

// -----------------------------------------------------------------------------
// i18n initialization for tests (delegated)
// -----------------------------------------------------------------------------
initI18nForTesting();

// -----------------------------------------------------------------------------
// Test database helpers
// -----------------------------------------------------------------------------
// `setupTestDb()` maintains its own singleton connection; calling it
// repeatedly will force-sync the schema (clearing data).  We expose the
// returned object on `globalThis.testDb` for convenience in tests.

beforeAll(async () => {
  // Create the database and load all Sequelize models ONCE per test file
  globalThis.testDb = await setupTestDb();
});

beforeEach(async () => {
  // Truncate all tables before each test by force-syncing the schema.
  // This achieves perfect test isolation without the massive overhead
  // of reloading models and destroying/rebuilding the connection.
  if (globalThis.testDb) {
    await globalThis.testDb.sequelize.sync({ force: true });
  }
});

afterAll(async () => {
  if (globalThis.testDb) {
    // Correctly pass the sequelize instance to prevent connection leaks!
    await closeTestDb(globalThis.testDb.sequelize);
    delete globalThis.testDb;
  }
});
