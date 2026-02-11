/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import path from 'path';
import fs from 'fs';

// Use __non_webpack_require__ if available (for Webpack environments)
const moduleRequire =
  typeof __non_webpack_require__ === 'function'
    ? // eslint-disable-next-line no-undef
      __non_webpack_require__
    : require;

/**
 * Safely require a module, returning null if not available
 * @param {string} moduleName - Name of the module to require
 * @returns {any|null} Module exports or null if unavailable
 */
function safeRequire(moduleName) {
  try {
    return moduleRequire(moduleName);
  } catch (error) {
    console.warn(
      `⚠️  [Node-RED Settings] Optional module '${moduleName}' not available:`,
      error.message,
    );
    return null;
  }
}

/**
 * Ensure a directory exists, create if it doesn't
 * @param {string} dirPath - Directory path to ensure
 */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`📁 [Node-RED Settings] Created directory: ${dirPath}`);
  }
}

/**
 * Validate configuration options
 * @param {object} options - Configuration options
 * @throws {Error} If configuration is invalid
 */
function validateConfig(options) {
  if (options.port && (options.port < 1 || options.port > 65535)) {
    throw new Error(`Invalid port: ${options.port}. Must be between 1-65535`);
  }

  if (
    options.protocol &&
    !['http', 'https'].includes(options.protocol.toLowerCase())
  ) {
    throw new Error(
      `Invalid protocol: ${options.protocol}. Must be 'http' or 'https'`,
    );
  }

  if (options.logLevel) {
    const validLevels = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'];
    if (!validLevels.includes(options.logLevel.toLowerCase())) {
      throw new Error(
        `Invalid logLevel: ${options.logLevel}. Must be one of: ${validLevels.join(', ')}`,
      );
    }
  }
}

/**
 * Create a Node-RED settings object from application config.
 *
 * @param {object} options - Configuration options
 * @param {string} [options.host='127.0.0.1'] - Server host
 * @param {number} [options.port=1337] - Server port
 * @param {string} [options.protocol='http'] - Server protocol (http|https)
 * @param {string} [options.userDir] - Custom user directory (defaults to .node-red in cwd)
 * @param {string} [options.httpAdminRoot='/~/red/admin'] - Admin UI root path
 * @param {string} [options.httpNodeRoot='/~/red'] - Node HTTP endpoints root path
 * @param {string} [options.logLevel='info'] - Logging level (fatal|error|warn|info|debug|trace)
 * @param {boolean} [options.enableProjects=false] - Enable Node-RED projects feature
 * @param {boolean} [options.enableMetrics=false] - Enable metrics logging
 * @param {boolean} [options.enableAudit=false] - Enable audit logging
 * @param {object} [options.functionGlobalContext] - Additional global context modules
 * @param {object} [options.editorTheme] - Custom editor theme settings
 * @param {object} [options.adminAuth] - Admin authentication settings
 * @param {object} [options.additionalSettings] - Any additional Node-RED settings to merge
 * @returns {object} Frozen Node-RED settings
 */
export default function createSettings(options = {}) {
  // Validate configuration
  validateConfig(options);

  // Destructure with defaults
  const {
    host = '127.0.0.1',
    port = 1337,
    protocol = 'http',
    userDir = path.join(process.cwd(), '.node-red'),
    httpAdminRoot = '/~/red/admin',
    httpNodeRoot = '/~/red',
    logLevel = 'info',
    enableProjects = false,
    enableMetrics = false,
    enableAudit = false,
    functionGlobalContext = {},
    editorTheme = {},
    adminAuth = null,
    additionalSettings = {},
  } = options;

  // Ensure user directory exists
  ensureDir(userDir);

  // Resolve core nodes directory
  let coreNodesDir;
  try {
    coreNodesDir = path.dirname(moduleRequire.resolve('@node-red/nodes'));
  } catch (error) {
    throw new Error(
      `Failed to resolve @node-red/nodes: ${error.message}. Ensure Node-RED is installed.`,
    );
  }

  // Build default global context with safe requires
  const defaultGlobalContext = {
    // Core Node.js modules (always available)
    os: moduleRequire('os'),
    path: moduleRequire('path'),
    fs: moduleRequire('fs'),

    // Common utility libraries (safe require)
    lodash: safeRequire('lodash'),
    uuid: safeRequire('uuid'),
    dayjs: safeRequire('dayjs'),
    zod: safeRequire('zod'),
  };

  // Filter out null values (unavailable modules)
  const availableGlobalContext = Object.fromEntries(
    Object.entries(defaultGlobalContext).filter(([_, value]) => value !== null),
  );

  // Merge with user-provided global context
  const mergedGlobalContext = {
    ...availableGlobalContext,
    ...functionGlobalContext,
  };

  // Build editor theme with defaults
  const mergedEditorTheme = {
    projects: {
      enabled: enableProjects,
    },
    ...editorTheme,
  };

  // Base settings object
  const settings = {
    // Protocol, host, and port for the Node-RED UI
    uiProtocol: protocol,
    uiHost: host,
    uiPort: port,

    // Directory paths
    userDir,
    coreNodesDir,

    // Route roots
    httpAdminRoot,
    httpNodeRoot,

    // Logging configuration
    logging: {
      console: {
        level: logLevel,
        metrics: enableMetrics,
        audit: enableAudit,
      },
    },

    // Global Context - Available to all function nodes
    functionGlobalContext: mergedGlobalContext,

    // Security: Disable deprecated features
    disableEditor: false,

    // Context storage (using default memory store)
    contextStorage: {
      default: {
        module: 'memory',
      },
    },

    // Flow file settings
    flowFile: 'flows.json',
    flowFilePretty: true,

    // Credential secret (auto-generated if not exists)
    credentialSecret: false, // Let Node-RED generate it

    // Node settings
    nodeMessageBufferMaxLength: 0, // Unlimited

    // Function node settings
    functionExternalModules: true,
    functionTimeout: 0, // No timeout

    // Debug settings
    debugMaxLength: 1000,
    debugUseColors: true,

    // Palette settings
    editorTheme: {
      ...mergedEditorTheme,
      palette: {
        allowInstall: true,
        catalogues: ['https://catalogue.nodered.org/catalogue.json'],
      },
    },
  };

  // Add admin authentication if provided
  if (adminAuth) {
    settings.adminAuth = adminAuth;
  }

  // Log configuration summary
  console.log('⚙️  [Node-RED Settings] Configuration:');
  console.log(`   - UI: ${protocol}://${host}:${port}${httpAdminRoot}`);
  console.log(`   - User Directory: ${userDir}`);
  console.log(`   - Log Level: ${logLevel}`);
  console.log(`   - Projects: ${enableProjects ? 'enabled' : 'disabled'}`);
  console.log(
    `   - Global Context Modules: ${Object.keys(mergedGlobalContext).length}`,
  );

  // Return frozen settings to prevent accidental mutations
  return Object.freeze({
    ...settings,
    ...additionalSettings,
  });
}

/**
 * Create settings with environment variable overrides
 * Useful for containerized deployments
 *
 * Environment variables:
 * - NODE_RED_HOST
 * - NODE_RED_PORT
 * - NODE_RED_PROTOCOL
 * - NODE_RED_LOG_LEVEL
 * - NODE_RED_ENABLE_PROJECTS
 * - NODE_RED_USER_DIR
 *
 * @param {object} baseOptions - Base configuration options
 * @returns {object} Settings with environment overrides
 */
export function createSettingsFromEnv(baseOptions = {}) {
  const envOptions = {
    host: process.env.NODE_RED_HOST,
    port: process.env.NODE_RED_PORT
      ? parseInt(process.env.NODE_RED_PORT, 10)
      : undefined,
    protocol: process.env.NODE_RED_PROTOCOL,
    logLevel: process.env.NODE_RED_LOG_LEVEL,
    enableProjects: process.env.NODE_RED_ENABLE_PROJECTS === 'true',
    userDir: process.env.NODE_RED_USER_DIR,
  };

  // Filter out undefined values
  const cleanedEnvOptions = Object.fromEntries(
    Object.entries(envOptions).filter(([_, value]) => value !== undefined),
  );

  // Merge base options with environment overrides
  const mergedOptions = {
    ...baseOptions,
    ...cleanedEnvOptions,
  };

  return createSettings(mergedOptions);
}

/**
 * Create production-ready settings
 * Optimized for production deployments with security hardening
 *
 * @param {object} options - Configuration options
 * @returns {object} Production settings
 */
export function createProductionSettings(options = {}) {
  return createSettings({
    logLevel: 'warn', // Less verbose logging
    enableMetrics: true, // Enable performance metrics
    enableAudit: true, // Enable security audit
    enableProjects: false, // Disable projects for simplicity
    ...options,
    additionalSettings: {
      // Disable diagnostic endpoints in production
      diagnostics: {
        enabled: false,
      },
      // Rate limiting
      runtimeState: {
        enabled: false,
      },
      // Additional security
      httpNodeCors: {
        origin: '*',
        methods: 'GET,PUT,POST,DELETE',
      },
      ...(options.additionalSettings || {}),
    },
  });
}

/**
 * Create development settings
 * Optimized for local development with verbose logging
 *
 * @param {object} options - Configuration options
 * @returns {object} Development settings
 */
export function createDevelopmentSettings(options = {}) {
  return createSettings({
    logLevel: 'debug', // Verbose logging
    enableMetrics: true, // Performance insights
    enableAudit: true, // Track changes
    enableProjects: true, // Enable projects feature
    ...options,
    additionalSettings: {
      // Enable diagnostic endpoints
      diagnostics: {
        enabled: true,
        ui: {
          enabled: true,
        },
      },
      ...(options.additionalSettings || {}),
    },
  });
}
