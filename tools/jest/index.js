/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

const path = require('path');

const config = require('../config');

// Environment-based configuration
const isCI = config.env('CI') === 'true';
const isCoverage = config.env('JEST_COVERAGE') === 'true';
const isWatch = config.env('JEST_WATCH') === 'true';
const isVerbose = config.env('JEST_VERBOSE') !== 'false';
// support benchmark mode (only run *.benchmark.js files)
const isBenchmark = config.env('JEST_BENCHMARK') === 'true';
const maxWorkers = config.env('JEST_MAX_WORKERS', isCI ? 2 : '50%');

// Relative path to app directory
const appDir = path.relative(config.CWD, config.APP_DIR);
const sharedDir = path.relative(config.CWD, path.resolve(config.CWD, 'shared'));

module.exports = {
  /**
   * Automatically clear mock calls, instances, contexts and results before every test.
   * Equivalent to calling jest.clearAllMocks() before each test.
   */
  clearMocks: true,

  /**
   * Indicates whether the coverage information should be collected while executing the test.
   * Enable via COVERAGE=true environment variable or --coverage flag.
   */
  // disable coverage while benchmarking to avoid skewing timings
  collectCoverage: isCoverage && !isBenchmark,

  /**
   * An array of glob patterns indicating a set of files for which coverage
   * information should be collected.
   */
  collectCoverageFrom: [
    `${appDir}/**/*.{js,jsx}`,
    `${sharedDir}/**/*.{js,jsx}`,
    // Exclude common non-testable files
    `!${appDir}/**/*.test.{js,jsx}`,
    `!${appDir}/**/*.spec.{js,jsx}`,
    `!${appDir}/**/__tests__/**`,
    `!${appDir}/**/__mocks__/**`,
    `!${sharedDir}/**/*.test.{js,jsx}`,
    `!${sharedDir}/**/*.spec.{js,jsx}`,
    `!${sharedDir}/**/__tests__/**`,
    `!${sharedDir}/**/__mocks__/**`,
    '!**/node_modules/**',
    '!**/tools/**',
    '!**/vendor/**',
    '!**/coverage/**',
    '!**/build/**',
    '!**/release/**',
    '!**/out/**',
    '!**/.cache/**',
  ],

  /**
   * The directory where Jest should output its coverage files.
   */
  coverageDirectory: '<rootDir>/coverage',

  /**
   * An array of regexp pattern strings used to skip coverage collection.
   * Note: Most exclusions are handled by collectCoverageFrom patterns.
   * This only needs to exclude node_modules which is outside the src directory.
   */
  coveragePathIgnorePatterns: ['/node_modules/'],

  /**
   * A list of reporter names that Jest uses when writing coverage reports.
   * Available reporters: text, lcov, html, json, json-summary, cobertura, teamcity, clover
   */
  coverageReporters: [
    'text',
    'text-summary',
    'lcov',
    'html',
    ...(isCI ? ['json', 'json-summary'] : []),
  ],

  /**
   * Coverage thresholds to enforce minimum coverage percentages.
   * Tests will fail if coverage falls below these thresholds.
   *
   * Note: Set to 0 for starter kit. Increase these values as you add more tests.
   * Recommended production values: 80% for all metrics.
   */
  coverageThreshold: {
    global: {
      branches: 0,
      functions: 0,
      lines: 0,
      statements: 0,
    },
  },

  /**
   * The test environment that will be used for testing.
   * jsdom simulates a browser environment for React component testing.
   */
  testEnvironment: '<rootDir>/tools/jest/node-environment.js',

  /**
   * Test environment options for jsdom.
   */
  testEnvironmentOptions: {
    url: 'http://localhost',
  },

  /**
   * Global variables available in all test environments.
   * Note: NODE_ENV is automatically set to 'test' by Jest.
   */
  globals: {
    __DEV__: false,
    __TEST__: true,
  },

  /**
   * An array of file extensions your modules use.
   * Jest will look for these extensions when resolving modules.
   */
  moduleFileExtensions: [
    'js',
    'jsx',
    'json',
    'node',
    // Future TypeScript support
    // 'ts',
    // 'tsx',
  ],

  /**
   * An array of directory names to be searched recursively up from the requiring module's location.
   */
  moduleDirectories: ['node_modules', config.APP_DIR],

  /**
   * A map from regular expressions to module names that allow to stub out resources
   * with a single module (e.g., images, styles).
   */
  moduleNameMapper: {
    // Resolve @shared alias to the shared directory
    // This ensures jest.mock('@shared/...') resolves the same way
    // as babel-plugin-module-resolver does for import statements
    '^@shared/(.*)$': '<rootDir>/shared/$1',

    // Style files
    '\\.(css|less|styl|scss|sass|sss)$': 'identity-obj-proxy',

    // Image and font files - return the filename as a string
    '\\.(jpg|jpeg|png|gif|svg|webp|ico)$': 'jest-transform-stub',
    '\\.(woff|woff2|eot|ttf|otf)$': 'jest-transform-stub',
  },

  /**
   * The root directory that Jest should scan for tests and modules within.
   */
  rootDir: config.CWD,

  /**
   * A list of paths to directories that Jest should use to search for files in.
   * This limits Jest to only look in the src directory, automatically excluding
   * tools, build, release, out, and coverage directories.
   */
  roots: [config.APP_DIR, path.resolve(config.CWD, 'shared')],

  /**
   * The glob patterns Jest uses to detect test files.
   */
  // Determine which files jest should treat as test suites. In normal
  // mode we only pick up *.test.js and *.spec.js inside the app directory.
  // When running benchmarks we switch to *.benchmark.js so that performance
  // tests are kept separate from unit tests.
  testMatch: isBenchmark
    ? ['**/?(*.)+(benchmark).{js,jsx}']
    : ['**/__tests__/**/*.{js,jsx}', '**/?(*.)+(spec|test).{js,jsx}'],

  /**
   * An array of regexp pattern strings that are matched against all test paths,
   * matched tests are skipped.
   */
  testPathIgnorePatterns: [
    '/node_modules/',
    '/tools/',
    '/build/',
    '/release/',
    '/out/',
    '/coverage/',
    '/.cache/',
  ],

  /**
   * A map from regular expressions to paths to transformers.
   * Transformers are modules that provide a synchronous function for transforming source files.
   */
  transform: {
    // JavaScript and JSX files
    '^.+\\.(js|jsx)$': 'babel-jest',
  },

  /**
   * An array of regexp pattern strings that are matched against all source file paths
   * before transformation. If the file path matches any of the patterns, it will not be transformed.
   *
   * By default, Jest doesn't transform node_modules. However, some packages ship ES6+ code
   * that needs to be transformed. The pattern below ignores all node_modules EXCEPT
   * identity-obj-proxy (which needs transformation for CSS module mocking).
   */
  transformIgnorePatterns: ['/node_modules/(?!(identity-obj-proxy)/)'],

  /**
   * A list of paths to modules that run some code to configure or set up the testing
   * environment before each test file in the suite is executed.
   */
  setupFiles: ['<rootDir>/tools/jest/setup.js'],

  /**
   * A list of paths to modules that run some code to configure or set up the testing
   * framework before each test file in the suite is executed.
   */
  setupFilesAfterEnv: ['<rootDir>/tools/jest/setupAfterEnv.js'],

  /**
   * Stop running tests after the first failure.
   * Useful for CI environments to fail fast.
   */
  bail: isCI,

  /**
   * The maximum number of workers to use for running tests.
   * In CI: use 2 workers to avoid resource exhaustion
   * Locally: use 50% of available cores for better performance
   */
  maxWorkers,

  /**
   * Automatically reset mock state before every test.
   * Equivalent to calling jest.resetAllMocks() before each test.
   */
  resetMocks: false,

  /**
   * Automatically restore mock state and implementation before every test.
   * Equivalent to calling jest.restoreAllMocks() before each test.
   */
  restoreMocks: true,

  /**
   * The number of seconds after which a test is considered as slow and reported as such.
   * Note: This option is not available in Jest 24.9.0 (added in Jest 25+)
   */
  // slowTestThreshold: 5,

  /**
   * Indicates whether each individual test should be reported during the run.
   */
  verbose: isVerbose,

  /**
   * Indicates whether the test results should be displayed with colors in the terminal.
   * Note: This option is not available in Jest 24.9.0 (added in Jest 25+)
   */
  // colors: true,

  /**
   * An array of reporter names that Jest uses when writing test results.
   */
  reporters: isCI
    ? [
        'default',
        [
          'jest-junit',
          {
            outputDirectory: './coverage',
            outputName: 'junit.xml',
            classNameTemplate: '{classname}',
            titleTemplate: '{title}',
            ancestorSeparator: ' › ',
            usePathForSuiteName: true,
          },
        ],
      ]
    : ['default'],

  /**
   * Activates notifications for test results.
   * Useful during watch mode.
   */
  notify: isWatch,

  /**
   * An enum that specifies notification mode.
   */
  notifyMode: 'failure-change',

  /**
   * Display individual test results with the test suite hierarchy.
   */
  displayName: {
    name: 'xnapify',
    color: 'blue',
  },

  /**
   * Make calling deprecated APIs throw helpful error messages.
   */
  errorOnDeprecated: true,

  /**
   * Throw an error if any tests are failing.
   */
  // passWithNoTests: false,

  /**
   * Watch plugins to enhance the watch mode experience.
   * - filename: Filter tests by file name pattern
   * - testname: Filter tests by test name pattern
   */
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname',
  ],

  /**
   * An array of regexp pattern strings that are matched against all source file paths
   * before re-running tests in watch mode.
   */
  watchPathIgnorePatterns: [
    '/node_modules/',
    '/tools/',
    '/build/',
    '/out/',
    '/release/',
    '/coverage/',
    '/.cache/',
  ],

  /**
   * Automatically clear mock calls and instances before every test.
   */
  automock: false,

  /**
   * Respect Browserify's "browser" field in package.json when resolving modules.
   */
  browser: false,

  /**
   * Disable caching for Jest.
   * Set to false to disable caching entirely.
   */
  cache: false,

  /**
   * The directory where Jest should store its cached dependency information.
   * (Not used when cache is disabled)
   */
  cacheDirectory: '<rootDir>/.cache/jest',

  /**
   * An array of regexp patterns that are matched against all file paths before executing the test.
   */
  // forceCoverageMatch: [],

  /**
   * A set of global variables that need to be available in all test environments.
   */
  // globalSetup: undefined,
  // globalTeardown: undefined,

  /**
   * This option allows the use of a custom resolver.
   */
  // resolver: undefined,

  /**
   * Allows you to use a custom runner instead of Jest's default test runner.
   */
  // runner: 'jest-runner',

  /**
   * The paths to modules that run some code to configure or set up the testing framework.
   */
  // snapshotSerializers: [],

  /**
   * The test timeout in milliseconds.
   */
  testTimeout: 10000,

  /**
   * Setting this value to "fake" allows the use of fake timers for functions such as "setTimeout".
   */
  // timers: 'real',

  /**
   * An array of regexp pattern strings that are matched against all modules before
   * the module loader will automatically return a mock for them.
   */
  // unmockedModulePathPatterns: undefined,
};
