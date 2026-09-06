/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import fs from 'fs';
import path from 'path';

import merge from 'lodash/merge';

import { createRspackContextAdapter } from '@shared/utils/contextAdapter.js';
import { createNativeRequire } from '@shared/utils/createNativeRequire.js';
import { getDataDir } from '@shared/utils/env.js';

import { createNodeRedAuth, createNodeRedLogoutConfig } from './auth.js';

// Use native require to load Node-RED packages and optional modules
const nativeRequire = createNativeRequire(import.meta.url);

// Auto-discover all custom Node-RED node modules in ./nodes/
// Each module must export: getNodeJS() and getNodeHTML()
const nodesContexts = import.meta.webpackContext('./nodes', {
  recursive: false,
  regExp: /\.[cm]?[jt]s$/i,
});

// Auto-discover all client-side editor scripts in ./client-scripts/
// Each module must export: getScript() => string
const clientScriptsContexts = import.meta.webpackContext('./client-scripts', {
  recursive: false,
  regExp: /\.[cm]?[jt]s$/i,
});

/**
 * Safely require a module, returning null if not available
 * @param {string} moduleName - Name of the module to require
 * @returns {any|null} Module exports or null if unavailable
 */
function safeRequire(moduleName) {
  try {
    return nativeRequire(moduleName);
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
async function ensureDir(dirPath) {
  try {
    await fs.promises.access(dirPath);
  } catch {
    await fs.promises.mkdir(dirPath, { recursive: true });
    console.log(`📁 [Node-RED Settings] Created directory: ${dirPath}`);
  }
}

/**
 * Get the extension modules directory path.
 * Extension nodes are written here as proper Node-RED modules (with package.json)
 * so they can be hot-loaded at runtime via the registry's addModule/removeModule API.
 *
 * @param {string} userDir - Node-RED user directory
 * @returns {string} Absolute path to the extension node_modules directory
 */
export function getExtModulesDir(userDir) {
  return path.join(userDir, 'node_modules');
}

/**
 * Resolve an extension's physical directory on disk by checking known paths.
 * Used internally by writeCustomNodes during boot (synchronous context).
 * For hot-load paths, use extensionManager.resolveExtensionDir() instead.
 *
 * @param {object} extensionManager - The server ExtensionManager instance
 * @param {string} extensionName - Extension name (e.g. '@xnapify-extension/foo')
 * @returns {string|null} Absolute path or null
 */
function resolveExtensionDirSync(extensionManager, extensionName) {
  const searchDirs = [];
  const installedDir = extensionManager.getInstalledExtensionsDir();
  if (installedDir) searchDirs.push(installedDir);
  const devDir = extensionManager.getDevExtensionsDir();
  if (devDir) searchDirs.push(devDir);

  // Fallback: build/extensions/
  const fallbackDir = path.resolve(process.cwd(), 'build', 'extensions');
  if (fs.existsSync(fallbackDir)) searchDirs.push(fallbackDir);

  for (const baseDir of searchDirs) {
    const candidate = path.join(baseDir, extensionName);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * Write an extension's nodes as a proper Node-RED module.
 *
 * Creates a directory with package.json + .js/.html files so that
 * Node-RED's registry can discover and hot-load them via addModule().
 *
 * @param {string} userDir - Node-RED user directory
 * @param {string} moduleId - Unique module name (e.g. 'xnapify-nodered-abc123')
 * @param {string} extNodesDir - Path to the extension's api/nodes/ directory
 * @returns {{ moduleName: string, nodeNames: string[] } | null}
 */
export async function writeExtensionNodeModule(userDir, moduleId, extNodesDir) {
  try {
    await fs.promises.access(extNodesDir);
  } catch {
    return null;
  }

  const allFiles = await fs.promises.readdir(extNodesDir);
  const files = allFiles.filter(f => /\.[cm]?[jt]s$/i.test(f));
  if (files.length === 0) return null;

  const moduleName = `xnapify-nodered-${moduleId}`;
  const moduleDir = path.join(getExtModulesDir(userDir), moduleName);

  // Wipe and recreate to ensure clean state
  await fs.promises
    .rm(moduleDir, { recursive: true, force: true })
    .catch(() => {});
  await fs.promises.mkdir(moduleDir, { recursive: true });

  const nodeEntries = {};
  const nodeNames = [];
  const nativeReq = nativeRequire;

  for (const file of files) {
    const baseName = path.basename(file).replace(/\.[cm]?[jt]s$/i, '');
    try {
      const modPath = path.join(extNodesDir, file);

      // Clear require cache to pick up changes
      try {
        const resolved = nativeReq.resolve(modPath);
        delete nativeReq.cache[resolved];
      } catch {
        // not cached yet
      }

      const mod = nativeReq(modPath);
      const getJS = mod.getNodeJS || (mod.default && mod.default.getNodeJS);
      const getHTML =
        mod.getNodeHTML || (mod.default && mod.default.getNodeHTML);

      if (typeof getJS !== 'function' || typeof getHTML !== 'function') {
        console.warn(
          `⚠️  [Node-RED Settings] Skipping ext node "${baseName}" — missing getNodeJS() or getNodeHTML()`,
        );
        continue;
      }

      const jsFile = `${baseName}.js`;
      await fs.promises.writeFile(
        path.join(moduleDir, jsFile),
        getJS(),
        'utf8',
      );
      await fs.promises.writeFile(
        path.join(moduleDir, `${baseName}.html`),
        getHTML(),
        'utf8',
      );

      nodeEntries[baseName] = jsFile;
      nodeNames.push(baseName);

      console.log(
        `📦 [Node-RED Settings] Extension node "${moduleName}/${baseName}" written`,
      );
    } catch (err) {
      console.warn(
        `⚠️  [Node-RED Settings] Failed to write ext node "${baseName}":`,
        err.message,
      );
    }
  }

  if (Object.keys(nodeEntries).length === 0) {
    // No valid nodes — clean up
    await fs.promises.rm(moduleDir, { recursive: true, force: true });
    return null;
  }

  // Write package.json with "node-red" section so the registry can discover it
  const pkg = {
    name: moduleName,
    version: '1.0.0',
    description: `Node-RED nodes from xnapify extension ${moduleId}`,
    'node-red': {
      nodes: nodeEntries,
    },
  };
  await fs.promises.writeFile(
    path.join(moduleDir, 'package.json'),
    JSON.stringify(pkg, null, 2),
    'utf8',
  );

  return { moduleName, nodeNames };
}

/**
 * Remove an extension's Node-RED module from disk.
 *
 * @param {string} userDir - Node-RED user directory
 * @param {string} moduleId - Extension module ID
 */
export async function removeExtensionNodeModule(userDir, moduleId) {
  const moduleName = `xnapify-nodered-${moduleId}`;
  const moduleDir = path.join(getExtModulesDir(userDir), moduleName);
  try {
    await fs.promises.access(moduleDir);
    await fs.promises.rm(moduleDir, { recursive: true, force: true });
    console.log(
      `🗑️  [Node-RED Settings] Removed extension module "${moduleName}"`,
    );
  } catch {
    // Directory doesn't exist — nothing to remove
  }
}

/**
 * Write custom Node-RED nodes to userDir so they can be loaded from disk.
 * Node-RED requires real files on the filesystem (it cannot load from a rspack bundle).
 *
 * Handles ONLY core xnapify nodes (from ./nodes/ rspack context).
 * Extension nodes are handled separately via writeExtensionNodeModule()
 * and hot-loaded at runtime using the registry's addModule() API.
 *
 * @param {string} userDir - Node-RED user directory
 * @param {object} [app] - Express app instance
 * @returns {string[]} Array of nodesDir paths for Node-RED settings
 */
async function writeCustomNodes(userDir, app) {
  const nodesDir = path.join(userDir, 'nodes');
  const xnapifyDir = path.join(nodesDir, 'xnapify');

  // Wipe and recreate the xnapify core nodes directory
  await fs.promises
    .rm(xnapifyDir, { recursive: true, force: true })
    .catch(() => {});
  await fs.promises.mkdir(xnapifyDir, { recursive: true });

  // Create adapter for nodes context
  const nodesAdapter = createRspackContextAdapter(nodesContexts);

  const modulePaths = nodesAdapter.files();
  const seen = new Set();

  for (const modulePath of modulePaths) {
    // Extract basename without extension, e.g. './xnapify-auth-middleware.js' → 'xnapify-auth-middleware'
    const baseName = path.basename(modulePath).replace(/\.[cm]?[jt]s$/i, '');
    if (seen.has(baseName)) continue;
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
        continue;
      }

      await fs.promises.writeFile(
        path.join(xnapifyDir, `${baseName}.js`),
        getJS(),
        'utf8',
      );
      await fs.promises.writeFile(
        path.join(xnapifyDir, `${baseName}.html`),
        getHTML(),
        'utf8',
      );

      console.log(
        `📦 [Node-RED Settings] Node "${baseName}" written to`,
        xnapifyDir,
      );
    } catch (err) {
      console.warn(
        `⚠️  [Node-RED Settings] Failed to write node "${baseName}":`,
        err.message,
      );
    }
  }

  // Write extension node modules for all currently active extensions.
  // During boot, these will be auto-discovered by NR's scanTreeForNodesModules.
  // After boot, new extensions use the hot-load path (addModule) in NodeRedManager.
  const extModDir = getExtModulesDir(userDir);
  await ensureDir(extModDir);

  if (app) {
    const container =
      typeof app.get === 'function' ? app.get('container') : null;
    const extensionManager = container ? container.resolve('extension') : null;

    if (extensionManager) {
      try {
        const activeExtensions = extensionManager.getAllExtensionMetadata();
        for (const metadata of activeExtensions) {
          const { id: extId, manifest } = metadata;
          if (!extId || !manifest || !manifest.name) continue;
          const extDir = resolveExtensionDirSync(
            extensionManager,
            manifest.name,
          );
          if (!extDir) continue;

          const noderedKey = manifest.nodered;
          const nodesRel =
            noderedKey && typeof noderedKey === 'object'
              ? noderedKey.nodes
              : null;
          const extNodesDir = nodesRel
            ? path.join(extDir, nodesRel)
            : path.join(extDir, 'api', 'nodes');

          // Use extId (registry key) — same key used by hot-load path
          await writeExtensionNodeModule(userDir, extId, extNodesDir);
        }
      } catch (err) {
        console.warn(
          `⚠️  [Node-RED Settings] Failed to scan extension nodes:`,
          err.message,
        );
      }
    }
  }

  // Return ONLY core nodesDir. Node-RED automatically discovers node_modules/
  return [nodesDir];
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
async function writeClientScripts(userDir) {
  const scriptsDir = path.join(userDir, 'scripts');
  await ensureDir(scriptsDir);

  // Create adapter for client scripts context
  const clientScriptsAdapter = createRspackContextAdapter(
    clientScriptsContexts,
  );

  const scriptPaths = [];
  const modulePaths = clientScriptsAdapter.files();
  const seen = new Set();

  for (const modulePath of modulePaths) {
    const baseName = path.basename(modulePath).replace(/\.[cm]?[jt]s$/i, '');
    if (seen.has(baseName)) continue;
    seen.add(baseName);

    try {
      const mod = clientScriptsAdapter.load(modulePath);
      const getScript = mod.getScript || (mod.default && mod.default.getScript);

      if (typeof getScript !== 'function') {
        console.warn(
          `\u26a0\ufe0f  [Node-RED Settings] Skipping script "${baseName}" \u2014 missing getScript()`,
        );
        continue;
      }

      const outputPath = path.join(scriptsDir, `${baseName}.js`);
      await fs.promises.writeFile(outputPath, getScript(), 'utf8');
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
  }

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
 * @param {string} [options.userDir] - Custom user directory (defaults to ~/.xnapify/node-red in cwd)
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
export default async function createSettings(options = {}) {
  // Validate configuration
  validateConfig(options);

  // Destructure with defaults
  const {
    app = null,
    host = '127.0.0.1',
    port = 1337,
    protocol = 'http',
    userDir = process.env.XNAPIFY_NODERED_HOME
      ? path.resolve(process.env.XNAPIFY_NODERED_HOME)
      : getDataDir('node-red'),
    logLevel = process.env.XNAPIFY_NODERED_LOG_LEVEL || 'info',
    enableProjects = process.env.XNAPIFY_NODERED_PROJECTS === 'true',
    httpAdminRoot = '/~/red/admin',
    httpNodeRoot = '/~/red',
    enableMetrics = false,
    enableAudit = false,
    functionGlobalContext = {},
    editorTheme = {},
    additionalSettings = {},
  } = options;

  // Ensure user directory exists
  await ensureDir(userDir);

  // Resolve core nodes directory
  let coreNodesDir;
  try {
    coreNodesDir = path.dirname(nativeRequire.resolve('@node-red/nodes'));
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
    os: safeRequire('os'),
    path: safeRequire('path'),
    fs: safeRequire('fs'),

    // Common utility libraries (safe require)
    lodash: safeRequire('lodash'),
    uuid: safeRequire('uuid'),
    dayjs: safeRequire('dayjs'),
    zod: safeRequire('zod'),
    liquidjs: safeRequire('liquidjs'),
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

    // Node-RED periodically POSTs anonymised usage metrics to
    // telemetry.nodered.org unless told otherwise (@node-red/runtime's
    // isTelemetryEnabled() treats "no settings" as disabled, but a prior
    // opt-in through the editor's banner persists past that default). This
    // is an embedded flow editor, not a standalone Node-RED install, so the
    // choice is made here rather than left to whoever clicks through it.
    telemetry: { enabled: false },

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
    nodesDir: await writeCustomNodes(userDir, app),

    // Extension modules directory — used by NodeRedManager to resolve
    // the node_modules path for hot-loading after boot.
    _extModulesDir: getExtModulesDir(userDir),

    // Palette settings
    editorTheme: await (async () => {
      // Write all client-side editor scripts to userDir
      const scriptPaths = await writeClientScripts(userDir);

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
 * @returns {Promise<object>} Production settings
 */
export async function createProductionSettings(options = {}) {
  return createSettings({
    logLevel: 'warn', // Less verbose logging
    enableMetrics: false, // Disables performance metrics
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
 * @returns {Promise<object>} Development settings
 */
export async function createDevelopmentSettings(options = {}) {
  return createSettings({
    logLevel: 'debug', // Verbose logging
    enableMetrics: false, // Performance insights disabled
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
