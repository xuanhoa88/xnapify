/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Node-RED Flow Splitter Extension
 *
 * Automatically splits flows.json into individual files (per tab, subflow,
 * and config-node) on every deploy or startup. When flows.json is empty,
 * it reconstructs from the split files.
 *
 * Inspired by node-red-contrib-flow-splitter.
 *
 * @param {object} RED - Node-RED runtime
 */

import fs from 'fs';
import path from 'path';

const EXTENSION_NAME = 'rsk-flow-splitter';
const EXTENSION_LOG_PREFIX = `[${EXTENSION_NAME}]`;
const SPLIT_CONFIG_FILE = '.config.flow-splitter.json';
const DEFAULT_CONFIG = Object.freeze({
  fileFormat: 'json',
  destinationFolder: 'src',
  tabsOrder: [],
});

/**
 * Generate a migration timestamp in the format: YYYY.MM.DDThh.mm.ss
 * @returns {string}
 */
function generateTimestamp() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  return [
    now.getFullYear(),
    '.',
    pad(now.getMonth() + 1),
    '.',
    pad(now.getDate()),
    'T',
    pad(now.getHours()),
    '.',
    pad(now.getMinutes()),
    '.',
    pad(now.getSeconds()),
  ].join('');
}

/**
 * Recursively copy a directory
 * @param {string} src - Source directory
 * @param {string} dest - Destination directory
 */
function copyDirSync(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Check if two directories have identical file contents
 * @param {string} dirA - First directory
 * @param {string} dirB - Second directory
 * @returns {boolean} True if contents are identical
 */
function dirsAreEqual(dirA, dirB) {
  if (!fs.existsSync(dirA) || !fs.existsSync(dirB)) return false;

  for (const subdir of ['tabs', 'subflows', 'config-nodes']) {
    const aDirPath = path.join(dirA, subdir);
    const bDirPath = path.join(dirB, subdir);
    const aExists = fs.existsSync(aDirPath);
    const bExists = fs.existsSync(bDirPath);

    if (!aExists && !bExists) continue;
    if (aExists !== bExists) return false;

    const aFiles = fs.readdirSync(aDirPath).sort();
    const bFiles = fs.readdirSync(bDirPath).sort();

    if (aFiles.length !== bFiles.length) return false;
    if (aFiles.join(',') !== bFiles.join(',')) return false;

    for (const file of aFiles) {
      const aContent = fs.readFileSync(path.join(aDirPath, file), 'utf8');
      const bContent = fs.readFileSync(path.join(bDirPath, file), 'utf8');
      if (aContent !== bContent) return false;
    }
  }
  return true;
}

/**
 * Save current split files as a timestamped migration snapshot
 * @param {string} splitDir - The split files source (.node-red/src)
 * @param {object} adapter - Webpack context adapter with files(), load(), resolve()
 * @param {object} RED - Node-RED runtime (for logging)
 */
function saveMigration(splitDir, adapter, RED) {
  if (!fs.existsSync(splitDir)) return;

  const migrationsDir = path.join(__dirname, 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    fs.mkdirSync(migrationsDir, { recursive: true });
  }

  // Get the latest migration timestamp from the filesystem (on disk)
  // This is more accurate than the bundled webpack context for live sessions
  const existingDirs = fs
    .readdirSync(migrationsDir)
    .filter(
      d =>
        fs.statSync(path.join(migrationsDir, d)).isDirectory() &&
        /^\d{4}\.\d{2}\.\d{2}T\d{2}\.\d{2}\.\d{2}$/.test(d),
    )
    .sort();

  if (existingDirs.length > 0) {
    const latestDir = path.join(
      migrationsDir,
      existingDirs[existingDirs.length - 1],
    );
    if (dirsAreEqual(splitDir, latestDir)) {
      RED.log.info(
        `${EXTENSION_LOG_PREFIX} No flow changes detected, skipping migration`,
      );
      return;
    }
  }

  const timestamp = generateTimestamp();
  const migrationDir = path.join(migrationsDir, timestamp);

  try {
    copyDirSync(splitDir, migrationDir);
    RED.log.info(`${EXTENSION_LOG_PREFIX} 💾 Migration saved: ${timestamp}`);
  } catch (err) {
    RED.log.error(
      `${EXTENSION_LOG_PREFIX} Failed to save migration: ${err.message}`,
    );
  }
}

/**
 * Apply the latest migration to the split files directory using webpack context adapter
 * @param {string} splitDir - The split files destination (.node-red/src)
 * @param {object} adapter - Webpack context adapter with files(), load(), resolve()
 * @param {object} RED - Node-RED runtime (for logging)
 * @returns {boolean} True if a migration was applied
 */
function applyLatestMigration(splitDir, adapter, RED) {
  const allKeys = adapter.files();
  if (allKeys.length === 0) return false;

  // Parse migration timestamps from keys
  // Keys look like: ./2026.02.16T15.30.00/tabs/test-hello.json
  const migrationMap = new Map(); // timestamp -> [{key, subdir, filename}]

  for (const key of allKeys) {
    const match = key.match(
      /^\.\/(\d{4}\.\d{2}\.\d{2}T\d{2}\.\d{2}\.\d{2})\/(tabs|subflows|config-nodes)\/(.+\.json)$/,
    );
    if (match) {
      const [, timestamp, subdir, filename] = match;
      if (!migrationMap.has(timestamp)) migrationMap.set(timestamp, []);
      migrationMap.get(timestamp).push({ key, subdir, filename });
    }
  }

  if (migrationMap.size === 0) return false;

  // Find the latest migration
  const timestamps = Array.from(migrationMap.keys()).sort();
  const latest = timestamps[timestamps.length - 1];
  const files = migrationMap.get(latest);

  RED.log.info(`${EXTENSION_LOG_PREFIX} 📦 Applying migration: ${latest}`);

  // Write each file from the adapter to the split dir
  for (const { key, subdir, filename } of files) {
    const content = adapter.load(key);
    const destDir = path.join(splitDir, subdir);
    fs.mkdirSync(destDir, { recursive: true });

    const destPath = path.join(destDir, filename);
    // content from require() of a JSON file is already a JS object
    fs.writeFileSync(destPath, JSON.stringify(content, null, 2));
    RED.log.info(`${EXTENSION_LOG_PREFIX} Restored: ${subdir}/${filename}`);
  }

  RED.log.info(`${EXTENSION_LOG_PREFIX} ✅ Migration applied: ${latest}`);
  return true;
}

/**
 * Normalize a string to a safe filename
 * @param {string} str - String to normalize
 * @returns {string} Safe filename
 */
function normalizeString(str) {
  return str
    .replace(/[^a-zA-Z0-9.]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

/**
 * Compare nodes by ID for stable sorting
 */
function compareById(a, b) {
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}

/**
 * Ensure directories exist
 * @param  {...string} dirs - Directory paths
 */
function ensureDirs(...dirs) {
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

/**
 * Parse a flat flows array into structured groups
 * @param {Array} flows - Flat array of all nodes
 * @returns {{ tabs: Array, subflows: Array, configNodes: Array }}
 */
function parseFlows(flows) {
  const tabs = [];
  const subflows = [];
  const configNodes = [];

  // First pass: identify tab and subflow definitions
  const tabIds = new Set();
  const subflowIds = new Set();

  for (const node of flows) {
    if (node.type === 'tab') {
      tabIds.add(node.id);
    } else if (node.type === 'subflow') {
      subflowIds.add(node.id);
    }
  }

  // Second pass: group nodes
  const tabNodeMap = new Map(); // tabId -> [nodes]
  const subflowNodeMap = new Map(); // subflowId -> [nodes]

  for (const node of flows) {
    if (node.type === 'tab') {
      // Tab definition node
      if (!tabNodeMap.has(node.id)) tabNodeMap.set(node.id, []);
      tabNodeMap.get(node.id).unshift(node); // Tab definition first
    } else if (node.type === 'subflow') {
      // Subflow definition node
      if (!subflowNodeMap.has(node.id)) subflowNodeMap.set(node.id, []);
      subflowNodeMap.get(node.id).unshift(node);
    } else if (node.z && tabIds.has(node.z)) {
      // Node belongs to a tab
      if (!tabNodeMap.has(node.z)) tabNodeMap.set(node.z, []);
      tabNodeMap.get(node.z).push(node);
    } else if (node.z && subflowIds.has(node.z)) {
      // Node belongs to a subflow
      if (!subflowNodeMap.has(node.z)) subflowNodeMap.set(node.z, []);
      subflowNodeMap.get(node.z).push(node);
    } else {
      // Global config node (no z, or z doesn't match known tab/subflow)
      configNodes.push(node);
    }
  }

  // Convert maps to arrays with labels
  for (const [tabId, nodes] of tabNodeMap) {
    const tabNode = nodes.find(n => n.type === 'tab');
    const label = tabNode ? tabNode.label || tabId : tabId;
    tabs.push({ id: tabId, label, nodes: nodes.sort(compareById) });
  }

  for (const [sfId, nodes] of subflowNodeMap) {
    const sfNode = nodes.find(n => n.type === 'subflow');
    const label = sfNode ? sfNode.name || sfId : sfId;
    subflows.push({ id: sfId, label, nodes: nodes.sort(compareById) });
  }

  return { tabs, subflows, configNodes: configNodes.sort(compareById) };
}

/**
 * Get a unique filename, avoiding duplicates
 * @param {Set} usedNames - Set of already-used names
 * @param {string} baseName - Desired name
 * @param {string} id - Fallback disambiguation ID
 * @returns {string}
 */
function getUniqueFilename(usedNames, baseName, id) {
  let name = normalizeString(baseName);
  if (usedNames.has(name)) {
    name = `${name}-${id}`;
  }
  usedNames.add(name);
  return name;
}

/**
 * Split flows into individual files
 * @param {Array} flowsArray - Full flows array
 * @param {object} config - Splitter config
 * @param {string} rootPath - Root project/user directory
 * @param {object} RED - Node-RED runtime (for logging)
 */
function splitFlows(flowsArray, config, rootPath, RED) {
  const { tabs, subflows, configNodes } = parseFlows(flowsArray);
  const destBase = path.join(rootPath, config.destinationFolder);

  const tabsDir = path.join(destBase, 'tabs');
  const subflowsDir = path.join(destBase, 'subflows');
  const configNodesDir = path.join(destBase, 'config-nodes');

  ensureDirs(tabsDir, subflowsDir, configNodesDir);

  const usedNames = new Set();
  const ext = config.fileFormat;

  // Write tabs
  for (const tab of tabs) {
    const filename = `${getUniqueFilename(usedNames, tab.label, tab.id)}.${ext}`;
    const filePath = path.join(tabsDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(tab.nodes, null, 2));
    RED.log.info(`${EXTENSION_LOG_PREFIX} Saved tab: ${tab.label} → ${filename}`);
  }

  // Write subflows
  for (const sf of subflows) {
    const filename = `${getUniqueFilename(usedNames, sf.label, sf.id)}.${ext}`;
    const filePath = path.join(subflowsDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(sf.nodes, null, 2));
    RED.log.info(
      `${EXTENSION_LOG_PREFIX} Saved subflow: ${sf.label} → ${filename}`,
    );
  }

  // Write config nodes
  if (configNodes.length > 0) {
    // Group individual config nodes by type+name, or write all in one file
    const filename = `_global.${ext}`;
    const filePath = path.join(configNodesDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(configNodes, null, 2));
    RED.log.info(
      `${EXTENSION_LOG_PREFIX} Saved ${configNodes.length} config node(s) → ${filename}`,
    );
  }

  // Update tabs order
  config.tabsOrder = tabs.map(t => t.id);
}

/**
 * Reconstruct flows from split files
 * @param {object} config - Splitter config
 * @param {string} rootPath - Root project/user directory
 * @param {object} RED - Node-RED runtime (for logging)
 * @returns {Array|null} Reconstructed flows array, or null if no files found
 */
function rebuildFlows(config, rootPath, RED) {
  const destBase = path.join(rootPath, config.destinationFolder);

  if (!fs.existsSync(destBase)) {
    RED.log.info(
      `${EXTENSION_LOG_PREFIX} No source directory found, skipping rebuild`,
    );
    return null;
  }

  let allNodes = [];

  // Read from tabs, subflows, config-nodes in order
  for (const subdir of ['tabs', 'subflows', 'config-nodes']) {
    const dir = path.join(destBase, subdir);
    if (!fs.existsSync(dir)) continue;

    const files = fs
      .readdirSync(dir)
      .filter(f => f.endsWith(`.${config.fileFormat}`));

    for (const file of files) {
      const filePath = path.join(dir, file);
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const nodes = JSON.parse(content);
        if (Array.isArray(nodes)) {
          allNodes = allNodes.concat(nodes);
          RED.log.info(
            `${EXTENSION_LOG_PREFIX} Loaded: ${subdir}/${file} (${nodes.length} node(s))`,
          );
        }
      } catch (err) {
        RED.log.warn(
          `${EXTENSION_LOG_PREFIX} Failed to parse ${subdir}/${file}: ${err.message}`,
        );
      }
    }
  }

  if (allNodes.length === 0) {
    RED.log.info(
      `${EXTENSION_LOG_PREFIX} No split files found, nothing to rebuild`,
    );
    return null;
  }

  // Reorder tabs according to tabsOrder if available
  if (config.tabsOrder && config.tabsOrder.length > 0) {
    for (let i = config.tabsOrder.length - 1; i >= 0; i--) {
      const refId = config.tabsOrder[i];
      const idx = allNodes.findIndex(n => n.id === refId);
      if (idx > 0) {
        const [node] = allNodes.splice(idx, 1);
        allNodes.unshift(node);
      }
    }
  }

  return allNodes;
}

/**
 * Read or create the splitter config
 * @param {string} rootPath - Root directory
 * @returns {object} config
 */
function readConfig(rootPath) {
  const cfgPath = path.join(rootPath, SPLIT_CONFIG_FILE);
  if (fs.existsSync(cfgPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
      return { ...DEFAULT_CONFIG, ...raw };
    } catch {
      return { ...DEFAULT_CONFIG };
    }
  }
  return { ...DEFAULT_CONFIG };
}

/**
 * Write the splitter config
 * @param {object} config - Config to write
 * @param {string} rootPath - Root directory
 */
function writeConfig(config, rootPath) {
  const cfgPath = path.join(rootPath, SPLIT_CONFIG_FILE);
  const toWrite = { ...config };
  fs.writeFileSync(cfgPath, JSON.stringify(toWrite, null, 2));
}

/**
 * Handle flows started event
 * @param {object} RED - Node-RED runtime
 * @returns {function} - Event handler
 */
function handleFlowsStarted(RED) {
  return async eventData => {
    RED.log.info(`${EXTENSION_LOG_PREFIX} Flow start event detected`);

    const { userDir } = RED.settings;
    if (!userDir) {
      RED.log.error(`${EXTENSION_LOG_PREFIX} userDir not configured`);
      return;
    }

    const rootPath = userDir;
    const config = readConfig(rootPath);
    config.monolithFilename = RED.settings.flowFile || 'flows.json';

    const flowsFromEvent =
      eventData && eventData.config && eventData.config.flows;
    const hasFlows = flowsFromEvent && flowsFromEvent.length > 0;

    if (!hasFlows) {
      // ─── Rebuild mode: no flows loaded, try to reconstruct ─────────
      RED.log.info(
        `${EXTENSION_LOG_PREFIX} No flows in runtime, attempting rebuild from split files`,
      );

      // Try to apply latest migration if no split files exist
      const splitDir = path.join(rootPath, config.destinationFolder);
      const adapter = RED.settings.migrationsAdapter;
      if (adapter && !fs.existsSync(splitDir)) {
        applyLatestMigration(splitDir, adapter, RED);
      }

      const rebuilt = rebuildFlows(config, rootPath, RED);
      if (!rebuilt) {
        RED.log.info(
          `${EXTENSION_LOG_PREFIX} No split files found, nothing to do`,
        );
        return;
      }

      // Write the rebuilt flows.json
      const monolithPath = path.join(rootPath, config.monolithFilename);
      fs.writeFileSync(monolithPath, JSON.stringify(rebuilt, null, 4));
      RED.log.info(
        `${EXTENSION_LOG_PREFIX} Rebuilt ${config.monolithFilename} with ${rebuilt.length} node(s)`,
      );

      // Reload flows in the runtime
      try {
        RED.log.info(`${EXTENSION_LOG_PREFIX} Reloading flows...`);
        await RED.nodes.loadFlows(true);
        RED.log.info(`${EXTENSION_LOG_PREFIX} Flows reloaded`);
      } catch (err) {
        RED.log.error(
          `${EXTENSION_LOG_PREFIX} Failed to reload flows: ${err.message}`,
        );
      }
      return;
    }

    // ─── Split mode: flows exist, split them ─────────────────────────
    RED.log.info(
      `${EXTENSION_LOG_PREFIX} Splitting ${flowsFromEvent.length} node(s) into individual files`,
    );

    splitFlows(flowsFromEvent, config, rootPath, RED);
    writeConfig(config, rootPath);

    // Auto-save migration snapshot
    const { migrationsAdapter } = RED.settings;
    if (migrationsAdapter) {
      const splitDir = path.join(rootPath, config.destinationFolder);
      saveMigration(splitDir, migrationsAdapter, RED);
    }

    // Delete the monolith file after splitting
    const monolithPath = path.join(rootPath, config.monolithFilename);
    try {
      // Small delay to ensure Node-RED has finished writing
      await new Promise(resolve => setTimeout(resolve, 200));
      if (fs.existsSync(monolithPath)) {
        fs.unlinkSync(monolithPath);
        RED.log.info(
          `${EXTENSION_LOG_PREFIX} Deleted ${config.monolithFilename} (split files are the source of truth)`,
        );
      }
    } catch (err) {
      RED.log.warn(
        `${EXTENSION_LOG_PREFIX} Could not delete ${config.monolithFilename}: ${err.message}`,
      );
    }

    RED.log.info(`${EXTENSION_LOG_PREFIX} Split complete ✅`);
  };
}

/**
 * Main extension export
 * @param {object} RED - Node-RED runtime
 */
export default function flowSplitter(RED) {
  RED.log.info(`${EXTENSION_LOG_PREFIX} Initializing...`);

  if (RED.events.rskFlowSplitterHandler) {
    RED.events.removeListener(
      'flows:started',
      RED.events.rskFlowSplitterHandler,
    );
  }

  RED.events.rskFlowSplitterHandler = handleFlowsStarted(RED);
  RED.events.on('flows:started', RED.events.rskFlowSplitterHandler);
}
