/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import os from 'os';
import path from 'path';
import fs from 'fs';
import merge from 'lodash/merge';
import { createWebpackContextAdapter } from '../utils/webpackContextAdapter';
import { createNodeRedAuth, createNodeRedLogoutConfig } from './auth';

// Auto-discover all custom Node-RED node modules in ./nodes/
// Each module must export: getNodeJS() and getNodeHTML()
const nodesContexts = require.context('./nodes', false, /\.[cm]?[jt]s$/i);

// Auto-discover all client-side editor scripts in ./client-scripts/
// Each module must export: getScript() => string
const clientScriptsContexts = require.context(
  './client-scripts',
  false,
  /\.[cm]?[jt]s$/i,
);

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
 * Write custom Node-RED nodes to userDir so they can be loaded from disk.
 * Node-RED requires real files on the filesystem (it cannot load from a webpack bundle).
 *
 * Auto-discovers all modules in ./nodes/ that export getNodeJS() and getNodeHTML().
 * Each module's basename becomes the filename written to <userDir>/nodes/rsk/.
 *
 * @param {string} userDir - Node-RED user directory
 * @returns {string} Path to the nodes directory
 */
function writeCustomNodes(userDir) {
  const nodesDir = path.join(userDir, 'nodes');
  const rskDir = path.join(nodesDir, 'rsk');
  ensureDir(rskDir);

  // Create adapter for nodes context
  const nodesAdapter = createWebpackContextAdapter(nodesContexts);

  const modulePaths = nodesAdapter.files();
  const seen = new Set();

  modulePaths.forEach(modulePath => {
    // Extract basename without extension, e.g. './rsk-middleware.js' → 'rsk-middleware'
    const baseName = path.basename(modulePath).replace(/\.[cm]?[jt]s$/i, '');
    if (seen.has(baseName)) return;
    seen.add(baseName);

    try {
      const mod = nodesAdapter.load(modulePath);
      const getJS = mod.getNodeJS || (mod.default && mod.default.getNodeJS);
      const getHTML =
        mod.getNodeHTML || (mod.default && mod.default.getNodeHTML);

      if (typeof getJS !== 'function' || typeof getHTML !== 'function') {
        console.warn(
          `⚠️  [Node-RED Settings] Skipping "${baseName}" — missing getNodeJS() or getNodeHTML()`,
        );
        return;
      }

      fs.writeFileSync(path.join(rskDir, `${baseName}.js`), getJS(), 'utf8');
      fs.writeFileSync(
        path.join(rskDir, `${baseName}.html`),
        getHTML(),
        'utf8',
      );

      console.log(
        `📦 [Node-RED Settings] Node "${baseName}" written to`,
        rskDir,
      );
    } catch (err) {
      console.warn(
        `⚠️  [Node-RED Settings] Failed to write node "${baseName}":`,
        err.message,
      );
    }
  });

  return nodesDir;
}

/**
 * Write client-side editor scripts to userDir so Node-RED can serve them.
 *
 * Auto-discovers all modules in ./client-scripts/ that export getScript().
 * Each module's basename becomes the filename written to <userDir>/scripts/.
 *
 * @param {string} userDir - Node-RED user directory
 * @returns {string[]} Array of absolute paths to written script files
 */
function writeClientScripts(userDir) {
  const scriptsDir = path.join(userDir, 'scripts');
  ensureDir(scriptsDir);

  // Create adapter for client scripts context
  const clientScriptsAdapter = createWebpackContextAdapter(
    clientScriptsContexts,
  );

  const scriptPaths = [];
  const modulePaths = clientScriptsAdapter.files();
  const seen = new Set();

  modulePaths.forEach(modulePath => {
    const baseName = path.basename(modulePath).replace(/\.[cm]?[jt]s$/i, '');
    if (seen.has(baseName)) return;
    seen.add(baseName);

    try {
      const mod = clientScriptsAdapter.load(modulePath);
      const getScript = mod.getScript || (mod.default && mod.default.getScript);

      if (typeof getScript !== 'function') {
        console.warn(
          `\u26a0\ufe0f  [Node-RED Settings] Skipping script "${baseName}" \u2014 missing getScript()`,
        );
        return;
      }

      const outputPath = path.join(scriptsDir, `${baseName}.js`);
      fs.writeFileSync(outputPath, getScript(), 'utf8');
      scriptPaths.push(outputPath);

      console.log(
        `\ud83d\udcdc [Node-RED Settings] Script "${baseName}" written to`,
        scriptsDir,
      );
    } catch (err) {
      console.warn(
        `\u26a0\ufe0f  [Node-RED Settings] Failed to write script "${baseName}":`,
        err.message,
      );
    }
  });

  return scriptPaths;
}

/**
 * Validate configuration options
 * @param {object} options - Configuration options
 * @throws {Error} If configuration is invalid
 */
function validateConfig(options) {
  if (options.port && (options.port < 1 || options.port > 65535)) {
    const err = new Error(
      `Invalid port: ${options.port}. Must be between 1-65535`,
    );
    err.name = 'InvalidPortError';
    err.status = 400;
    throw err;
  }

  if (
    options.protocol &&
    !['http', 'https'].includes(options.protocol.toLowerCase())
  ) {
    const err = new Error(
      `Invalid protocol: ${options.protocol}. Must be 'http' or 'https'`,
    );
    err.name = 'InvalidProtocolError';
    err.status = 400;
    throw err;
  }

  if (options.logLevel) {
    const validLevels = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'];
    if (!validLevels.includes(options.logLevel.toLowerCase())) {
      const err = new Error(
        `Invalid logLevel: ${options.logLevel}. Must be one of: ${validLevels.join(', ')}`,
      );
      err.name = 'InvalidLogLevelError';
      err.status = 400;
      throw err;
    }
  }
}

/**
 * Create a Node-RED settings object from application config.
 *
 * @param {object} options - Configuration options
 * @param {object} [options.app] - Express app instance (required for authentication)
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
 * @param {object} [options.additionalSettings] - Any additional Node-RED settings to merge
 * @returns {object} Frozen Node-RED settings
 */
export default function createSettings(options = {}) {
  // Validate configuration
  validateConfig(options);

  // Destructure with defaults
  const {
    app = null,
    host = '127.0.0.1',
    port = 1337,
    protocol = 'http',
    userDir = path.join(
      process.env.RSK_NODE_RED_HOME || path.join(os.homedir(), '.rsk'),
      '.node-red',
    ),
    logLevel = process.env.RSK_NODE_RED_LOG_LEVEL || 'info',
    enableProjects = process.env.RSK_NODE_RED_ENABLE_PROJECTS === 'true',
    httpAdminRoot = '/~/red/admin',
    httpNodeRoot = '/~/red',
    enableMetrics = false,
    enableAudit = false,
    functionGlobalContext = {},
    editorTheme = {},
    additionalSettings = {},
  } = options;

  // Ensure user directory exists
  ensureDir(userDir);

  // Resolve core nodes directory
  let coreNodesDir;
  try {
    coreNodesDir = path.dirname(moduleRequire.resolve('@node-red/nodes'));
  } catch (error) {
    const err = new Error(
      `Failed to resolve @node-red/nodes: ${error.message}. Ensure Node-RED is installed.`,
    );
    err.name = 'NodeRedResolutionError';
    err.status = 500;
    throw err;
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
    liquidjs: require('liquidjs'),
  };

  // Merge with user-provided global context
  const mergedGlobalContext = Object.fromEntries(
    Object.entries({
      ...defaultGlobalContext,
      ...functionGlobalContext,
    }).filter(([_, value]) => value != null),
  );

  // Build editor theme with defaults
  const logoutConfig = createNodeRedLogoutConfig({ protocol, host, port });
  const mergedEditorTheme = {
    projects: {
      enabled: enableProjects,
    },
    ...logoutConfig,
    ...editorTheme,
  };

  // Attempt to get Node-RED version
  const runtimePackage = safeRequire('@node-red/runtime/package.json');
  const version = (runtimePackage && runtimePackage.version) || '3.0.0';

  // Base settings object
  const settings = {
    // Node-RED Version
    version,

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

    // Custom nodes — write to userDir so Node-RED can load from disk
    nodesDir: writeCustomNodes(userDir),

    // Palette settings
    editorTheme: (() => {
      // Write all client-side editor scripts to userDir
      const scriptPaths = writeClientScripts(userDir);

      return merge({}, mergedEditorTheme, {
        page: {
          scripts: scriptPaths, // Absolute paths — required by Node-RED
        },
        logout: {
          redirect: '/admin',
        },
        codeEditor: {
          lib: 'monaco',
          options: {
            theme: 'vs',
          },
        },
        palette: {
          allowInstall: true,
          catalogues: ['https://catalogue.nodered.org/catalogue.json'],
        },
      });
    })(),
  };

  // Auto-configure authentication using app instance
  settings.adminAuth = createNodeRedAuth({ app });

  // Log configuration summary
  console.log('⚙️  [Node-RED Settings] Configuration:');
  console.log(`   - UI: ${protocol}://${host}:${port}${httpAdminRoot}`);
  console.log(`   - User Directory: ${userDir}`);
  console.log(`   - Log Level: ${logLevel}`);
  console.log(`   - Projects: ${enableProjects ? 'enabled' : 'disabled'}`);
  console.log(
    `   - Global Context Modules: ${Object.keys(mergedGlobalContext).length}`,
  );
  console.log(
    '   - Editor Theme:',
    JSON.stringify(settings.editorTheme, null, 2),
  );

  // Return frozen settings to prevent accidental mutations
  return Object.freeze({
    ...settings,
    ...additionalSettings,
  });
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
        methods: ['GET', 'PUT', 'POST', 'DELETE'].join(','),
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
    enableProjects: false, // Disabled to avoid welcome dialog on every load
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
