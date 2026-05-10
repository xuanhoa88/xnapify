/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import os from 'os';
import path from 'path';

const APP_NAME = process.env.XNAPIFY_APP_NAME || 'xnapify';

// ---------------------------------------------------------------------------
// OS-specific path resolvers (inspired by env-paths)
// ---------------------------------------------------------------------------

/**
 * Safely resolve the user home directory.
 * Falls back to cwd() in restricted Docker/K8s environments.
 * @returns {string}
 */
function safeHomedir() {
  try {
    return os.homedir() || process.cwd();
  } catch {
    return process.cwd();
  }
}

/** @param {string} name */
function macPaths(name) {
  const home = safeHomedir();
  const library = path.join(home, 'Library');

  return {
    data: path.join(library, 'Application Support', name),
    config: path.join(library, 'Preferences', name),
    cache: path.join(library, 'Caches', name),
    log: path.join(library, 'Logs', name),
    temp: path.join(os.tmpdir(), name),
  };
}

/** @param {string} name */
function winPaths(name) {
  const home = safeHomedir();
  const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
  const localAppData =
    process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');

  return {
    data: path.join(localAppData, name, 'Data'),
    config: path.join(appData, name, 'Config'),
    cache: path.join(localAppData, name, 'Cache'),
    log: path.join(localAppData, name, 'Log'),
    temp: path.join(os.tmpdir(), name),
  };
}

// https://specifications.freedesktop.org/basedir-spec/basedir-spec-latest.html
/** @param {string} name */
function linuxPaths(name) {
  const home = safeHomedir();
  const username = path.basename(home);

  return {
    data: path.join(
      process.env.XDG_DATA_HOME || path.join(home, '.local', 'share'),
      name,
    ),
    config: path.join(
      process.env.XDG_CONFIG_HOME || path.join(home, '.config'),
      name,
    ),
    cache: path.join(
      process.env.XDG_CACHE_HOME || path.join(home, '.cache'),
      name,
    ),
    log: path.join(
      process.env.XDG_STATE_HOME || path.join(home, '.local', 'state'),
      name,
    ),
    temp: path.join(os.tmpdir(), username, name),
  };
}

/**
 * Resolve OS-native paths for the application.
 *
 * In **development** all categories collapse into `<cwd>/.xnapify/`
 * so that project data lives inside the workspace.
 *
 * In **production** the paths follow OS conventions:
 * - macOS  → ~/Library/Application Support, ~/Library/Caches, …
 * - Linux  → XDG base directories
 * - Windows → %LOCALAPPDATA%, %APPDATA%
 *
 * The global `XNAPIFY_DATA_DIR` env var overrides everything.
 *
 * @returns {{ data: string, config: string, cache: string, log: string, temp: string }}
 */
function resolveEnvPaths() {
  // Global override – every category shares the same root
  if (process.env.XNAPIFY_DATA_DIR) {
    const base = path.resolve(process.env.XNAPIFY_DATA_DIR);
    return {
      data: base,
      config: base,
      cache: base,
      log: base,
      temp: base,
    };
  }

  // Development – keep everything local to the project workspace
  if (process.env.NODE_ENV !== 'production') {
    const base = path.join(process.cwd(), `.${APP_NAME}`);
    return {
      data: base,
      config: base,
      cache: base,
      log: base,
      temp: base,
    };
  }

  // Production – use OS-native conventions
  if (process.platform === 'darwin') {
    return macPaths(APP_NAME);
  }
  if (process.platform === 'win32') {
    return winPaths(APP_NAME);
  }
  return linuxPaths(APP_NAME);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get the application data directory with optional subpath segments.
 *
 * @param {...string} paths - Optional subpath segments
 * @returns {string} Absolute path
 * @example getDataDir('sqlite') → ~/Library/Application Support/xnapify/sqlite  (macOS prod)
 * @example getDataDir('sqlite') → <cwd>/.xnapify/sqlite                        (dev)
 */
export function getDataDir(...paths) {
  return path.join(resolveEnvPaths().data, ...paths);
}

/**
 * Get the application cache directory with optional subpath segments.
 *
 * @param {...string} paths - Optional subpath segments
 * @returns {string} Absolute path
 */
export function getCacheDir(...paths) {
  return path.join(resolveEnvPaths().cache, ...paths);
}

/**
 * Get the application config directory with optional subpath segments.
 *
 * @param {...string} paths - Optional subpath segments
 * @returns {string} Absolute path
 */
export function getConfigDir(...paths) {
  return path.join(resolveEnvPaths().config, ...paths);
}

/**
 * Get the application log directory with optional subpath segments.
 *
 * @param {...string} paths - Optional subpath segments
 * @returns {string} Absolute path
 */
export function getLogDir(...paths) {
  return path.join(resolveEnvPaths().log, ...paths);
}

/**
 * Get the application temp directory with optional subpath segments.
 *
 * @param {...string} paths - Optional subpath segments
 * @returns {string} Absolute path
 */
export function getTempDir(...paths) {
  return path.join(resolveEnvPaths().temp, ...paths);
}

/**
 * Backward-compatible alias for {@link getDataDir}.
 * @deprecated Use getDataDir() or getCacheDir() instead.
 * @param {...string} paths - Optional subpath segments
 * @returns {string} Absolute path
 */
export function getBaseDataDir(...paths) {
  return getDataDir(...paths);
}
