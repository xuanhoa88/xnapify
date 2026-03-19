/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Jest setup file that runs after the test environment is set up
 * but before each test file is executed.
 */

// jest/setupAfterEnv.js
// ----------------------
// Runs after the environment has been set up but before any individual
// test file executes.  We use it to configure i18next (so components
// render without errors) and to wire up an in‑memory database that can
// be reused across tests.

const { setupTestDb, closeTestDb } = require('./dbTest.setup');
const { initI18nForTesting } = require('./i18nTest.setup');

// -----------------------------------------------------------------------------
// i18n initialization for tests (delegated)
// -----------------------------------------------------------------------------
initI18nForTesting();

// -----------------------------------------------------------------------------
// Test database helpers
// -----------------------------------------------------------------------------
// `setupTestDb()` maintains its own singleton connection; calling it
// repeatedly will force-sync the schema (clearing data).  We expose the
// returned object on `global.testDb` for convenience in tests.

async function resetTestDb() {
  global.testDb = await setupTestDb();
}

beforeAll(async () => {
  // create the database once before all tests
  await resetTestDb();
});

beforeEach(async () => {
  // clear the database before each test by re-initializing
  await resetTestDb();
});

afterAll(async () => {
  if (global.testDb) {
    await closeTestDb();
    delete global.testDb;
  }
});
