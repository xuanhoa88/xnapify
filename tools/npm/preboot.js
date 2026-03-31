#!/usr/bin/env node

/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

'use strict';

/**
 * Database Preboot — ensures .env exists and the correct DB driver is ready.
 *
 * Used as:
 *   - "predev"   in root package.json   (npm run dev)
 *   - "pretest"  in root package.json   (npm test)
 *   - "prestart" in build package.json  (npm start — production)
 *
 * Auto mode (no flags): ensure .env → install driver → resolve PG server
 * Manual mode: node tools/npm/preboot.js --start | --stop | --status
 *
 * Cross-platform: macOS, Linux, Windows (x64 + arm64)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');

// ─── Constants ──────────────────────────────────────────────────────────────

const ROOT = process.cwd();
const ENV_PATH = path.join(ROOT, '.env');
const ENV_TEMPLATE = path.join(ROOT, '.env.xnapify');
const PG_DATA_DIR = path.join(ROOT, '.postgres');

const PG_DEFAULTS = {
  port: 5433,
  user: 'postgres',
  password: 'postgres',
  database: 'xnapify_dev',
};

const DIALECT_DEPS = (() => {
  const platMap = { darwin: 'darwin', linux: 'linux', win32: 'windows' };
  const archMap = { x64: 'x64', arm64: 'arm64' };
  const platKey = platMap[os.platform()] || os.platform();
  const archKey = archMap[os.arch()] || os.arch();
  const embeddedPkg = `@embedded-postgres/${platKey}-${archKey}`;

  return {
    // Pin sqlite3@5 — v6+ requires Node >= 20
    sqlite: [{ name: 'sqlite3', spec: 'sqlite3@^5.0.11' }],
    // pg + pg-hstore are always needed
    postgres: [
      { name: 'pg', spec: 'pg@^8.20.0' },
      { name: 'pg-hstore', spec: 'pg-hstore@^2.3.4' },
    ],
    // Platform-specific PG binaries (initdb, pg_ctl, postgres)
    _embedded: [{ name: embeddedPkg, spec: `${embeddedPkg}@^18.3.0-beta.16` }],
    mysql: [{ name: 'mysql2', spec: 'mysql2@^3.20.0' }],
  };
})();

/**
 * Load .env into process.env. Tries dotenv-flow first (supports
 * .env.local, .env.{NODE_ENV}, etc.). Falls back to manual .env
 * parsing if dotenv-flow is not installed yet.
 */
function loadEnv() {
  try {
    require('dotenv-flow').config({ silent: true });
  } catch {
    // dotenv-flow not installed — parse .env manually
    if (!fs.existsSync(ENV_PATH)) return;
    const lines = fs.readFileSync(ENV_PATH, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed
        .slice(idx + 1)
        .trim()
        .replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

// ─── .env Management ────────────────────────────────────────────────────────

/**
 * Create .env from .env.xnapify if it does not exist.
 */
function ensureEnvFile() {
  if (fs.existsSync(ENV_PATH)) return;

  if (fs.existsSync(ENV_TEMPLATE)) {
    fs.copyFileSync(ENV_TEMPLATE, ENV_PATH);
    console.log('📄 Created .env from .env.xnapify');
  }
}

/**
 * Update XNAPIFY_DB_URL in .env. Creates .env from template if missing.
 * @param {string} newUrl - New database URL value
 */
function updateEnvDbUrl(newUrl) {
  ensureEnvFile();

  if (!fs.existsSync(ENV_PATH)) {
    // No template either — create minimal .env
    fs.writeFileSync(ENV_PATH, `XNAPIFY_DB_URL=${newUrl}\n`, 'utf-8');
    return;
  }

  const content = fs.readFileSync(ENV_PATH, 'utf-8');
  const pattern = /^XNAPIFY_DB_URL=.*/m;

  if (pattern.test(content)) {
    // Replace existing line
    const updated = content.replace(pattern, `XNAPIFY_DB_URL=${newUrl}`);
    fs.writeFileSync(ENV_PATH, updated, 'utf-8');
  } else {
    // Append
    const separator = content.endsWith('\n') ? '' : '\n';
    fs.writeFileSync(
      ENV_PATH,
      `${content}${separator}XNAPIFY_DB_URL=${newUrl}\n`,
      'utf-8',
    );
  }
}

// ─── Dialect Detection ──────────────────────────────────────────────────────

/** @type {Set<string>} Valid dialect shorthand values */
const DIALECT_SHORTHANDS = new Set(
  Object.keys(DIALECT_DEPS).filter(k => !k.startsWith('_')),
);

/**
 * Detect SQL dialect from XNAPIFY_DB_URL.
 * Supports full URLs and shorthand values:
 *   'postgres' | 'postgresql://...' → postgres
 *   'mysql'    | 'mysql://...'      → mysql
 *   'sqlite'   | 'sqlite:...'       → sqlite (default)
 * @param {string} url - Database URL or shorthand
 * @returns {'sqlite'|'postgres'|'mysql'}
 */
function detectDialect(url) {
  if (!url) return 'sqlite';
  const lower = url.toLowerCase().trim();

  // Shorthand: bare dialect name (e.g. XNAPIFY_DB_URL=postgres)
  if (DIALECT_SHORTHANDS.has(lower)) return lower;

  // Full URL scheme
  if (/^postgres(ql)?:\/\//i.test(url)) return 'postgres';
  if (/^mysql:\/\//i.test(url)) return 'mysql';
  return 'sqlite';
}

// ─── Dependency Management ──────────────────────────────────────────────────

/**
 * Ensure dialect-specific packages are installed. Uses --no-save to avoid
 * modifying package.json. Skips if all packages are already resolvable.
 * @param {string} dialect - 'sqlite' | 'postgres' | 'mysql'
 */
function ensureDeps(dialect) {
  const deps = DIALECT_DEPS[dialect];
  if (!deps || deps.length === 0) return;

  // Check by module name, install by spec (with version pin)
  const missing = deps.filter(dep => {
    try {
      require.resolve(dep.name);
      return false;
    } catch {
      return true;
    }
  });

  if (missing.length === 0) return;

  const names = missing.map(d => d.name);
  const specs = missing.map(d => d.spec);

  console.log(`📦 Installing ${dialect} dependencies: ${names.join(', ')}...`);

  try {
    execSync(`npm install --no-save ${specs.join(' ')}`, {
      cwd: ROOT,
      stdio: 'pipe',
      timeout: 120_000,
      shell: true, // Required for Windows (cmd.exe)
    });
    // Bust Node's module resolution cache so require() finds the new packages
    // within this same process (avoids stale _pathCache from prior resolve())
    // eslint-disable-next-line no-underscore-dangle
    const pathCache = require('module')._pathCache;
    if (pathCache) {
      for (const key of Object.keys(pathCache)) {
        for (const dep of missing) {
          if (key.includes(dep.name)) {
            delete pathCache[key];
          }
        }
      }
    }

    console.log(`✅ ${dialect} dependencies installed`);
  } catch (err) {
    const message = err.stderr ? err.stderr.toString().trim() : err.message;
    throw new Error(`Failed to install ${dialect} deps: ${message}`);
  }
}

// ─── PostgreSQL Lifecycle ───────────────────────────────────────────────────

/**
 * Check if a TCP port is reachable (cross-platform).
 * @param {number} port
 * @param {string} [host='127.0.0.1']
 * @param {number} [timeout=1000]
 * @returns {Promise<boolean>}
 */
function isPortReachable(port, host = '127.0.0.1', timeout = 1000) {
  return new Promise(resolve => {
    const socket = new net.Socket();

    const onError = () => {
      socket.destroy();
      resolve(false);
    };

    socket.setTimeout(timeout);
    socket.once('error', onError);
    socket.once('timeout', onError);

    socket.connect(port, host, () => {
      socket.end();
      resolve(true);
    });
  });
}

/**
 * Parse connection details from a postgresql:// URL.
 * @param {string} url
 * @returns {{ user: string, password: string, host: string, port: number, database: string }}
 */
function parsePostgresUrl(url) {
  try {
    const parsed = new URL(url);
    return {
      user: parsed.username || PG_DEFAULTS.user,
      password: parsed.password || PG_DEFAULTS.password,
      host: parsed.hostname || '127.0.0.1',
      port: parseInt(parsed.port, 10) || PG_DEFAULTS.port,
      database: parsed.pathname.replace(/^\//, '') || PG_DEFAULTS.database,
    };
  } catch {
    return { ...PG_DEFAULTS, host: '127.0.0.1' };
  }
}

/**
 * Build a postgresql:// URL from config.
 * @param {{ user: string, password: string, port: number, database: string }} cfg
 * @returns {string}
 */
function buildPostgresUrl(cfg) {
  const user = cfg.user || PG_DEFAULTS.user;
  const password = cfg.password || PG_DEFAULTS.password;
  const port = cfg.port || PG_DEFAULTS.port;
  const database = cfg.database || PG_DEFAULTS.database;
  return `postgresql://${user}:${password}@127.0.0.1:${port}/${database}`;
}

/**
 * Start embedded PostgreSQL daemon. Idempotent — checks port first.
 *
 * Calls `initdb` and `pg_ctl` binaries directly from the
 * `@embedded-postgres/<platform>` package — no ESM imports required.
 *
 * @param {{ port?: number, user?: string, password?: string, database?: string }} [cfg]
 * @returns {Promise<void>}
 */
async function startPostgres(cfg = PG_DEFAULTS) {
  const port = cfg.port || PG_DEFAULTS.port;

  if (await isPortReachable(port)) {
    console.log(`🐘 PostgreSQL already running on port ${port}`);
    return;
  }

  console.log(`🐘 Starting embedded PostgreSQL on port ${port}...`);

  // Initialise data directory via initdb (idempotent — skips if already done)
  if (!fs.existsSync(path.join(PG_DATA_DIR, 'PG_VERSION'))) {
    const initdb = resolvePgBin('initdb');
    const user = cfg.user || PG_DEFAULTS.user;
    // --locale=C is universally available; --lc-messages may not exist on
    // Windows or minimal containers, so we only add it on platforms that
    // are likely to have the en_US.UTF-8 locale installed.
    const localeFlags =
      os.platform() === 'win32'
        ? '--locale=C'
        : '--locale=C --lc-messages=en_US.UTF-8';
    execSync(
      `"${initdb}" -D "${PG_DATA_DIR}" -U "${user}" --auth=trust --encoding=UTF8 ${localeFlags}`,
      { cwd: ROOT, stdio: 'inherit', timeout: 60_000, shell: true },
    );
  }

  // Resolve pg_ctl binary path from the embedded-postgres platform package
  const pgCtl = resolvePgBin('pg_ctl');

  // Write port override into postgresql.conf if needed
  const confPath = path.join(PG_DATA_DIR, 'postgresql.conf');
  let confContent = fs.readFileSync(confPath, 'utf-8');
  if (!confContent.includes(`port = ${port}`)) {
    confContent = confContent.replace(/^#?\s*port\s*=.*/m, `port = ${port}`);
    fs.writeFileSync(confPath, confContent, 'utf-8');
  }

  // Ensure listen on 127.0.0.1 only
  if (!confContent.includes("listen_addresses = '127.0.0.1'")) {
    confContent = confContent.replace(
      /^#?\s*listen_addresses\s*=.*/m,
      "listen_addresses = '127.0.0.1'",
    );
    fs.writeFileSync(confPath, confContent, 'utf-8');
  }

  // Start PG as a background daemon via pg_ctl (survives process exit)
  const logFile = path.join(PG_DATA_DIR, 'logfile');
  execSync(
    `"${pgCtl}" -D "${PG_DATA_DIR}" -l "${logFile}" -o "-p ${port}" start`,
    { cwd: ROOT, stdio: 'inherit', timeout: 30_000, shell: true },
  );

  // Wait for PG to become reachable
  const maxWait = 10_000;
  const start = Date.now();
  while (!(await isPortReachable(port)) && Date.now() - start < maxWait) {
    await new Promise(r => setTimeout(r, 200));
  }

  if (!(await isPortReachable(port))) {
    throw new Error(`PostgreSQL did not become reachable on port ${port}`);
  }

  // Create database (idempotent)
  const dbName = cfg.database || PG_DEFAULTS.database;
  try {
    const { Client } = require('pg');
    const client = new Client({
      host: '127.0.0.1',
      port,
      user: cfg.user || PG_DEFAULTS.user,
      password: cfg.password || PG_DEFAULTS.password,
      database: 'postgres',
    });
    await client.connect();
    // Check if database exists
    const result = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbName],
    );
    if (result.rowCount === 0) {
      await client.query(`CREATE DATABASE "${dbName}"`);
    }
    await client.end();
  } catch {
    // Database might already exist or pg not fully ready — non-fatal
  }

  console.log(
    `✅ PostgreSQL ready — ${buildPostgresUrl({ ...PG_DEFAULTS, ...cfg })}`,
  );
}

/**
 * Resolve a PostgreSQL binary from the installed @embedded-postgres platform package.
 * @param {string} binName - Binary name (e.g. 'pg_ctl', 'initdb', 'postgres')
 * @returns {string} Absolute path to the binary
 */
function resolvePgBin(binName) {
  const isWin = os.platform() === 'win32';
  // On Windows the binaries have a .exe extension
  const fileName = isWin ? `${binName}.exe` : binName;

  // Map Node arch/platform names to embedded-postgres package names
  const archMap = { x64: 'x64', arm64: 'arm64' };
  const platMap = { darwin: 'darwin', linux: 'linux', win32: 'windows' };

  const platKey = platMap[os.platform()] || os.platform();
  const archKey = archMap[os.arch()] || os.arch();
  const pkgName = `@embedded-postgres/${platKey}-${archKey}`;

  try {
    const pkgDir = path.dirname(require.resolve(`${pkgName}/package.json`));
    const bin = path.join(pkgDir, 'native', 'bin', fileName);
    if (fs.existsSync(bin)) return bin;
  } catch {
    // Fall through to glob search
  }

  // Fallback: search node_modules for any embedded-postgres platform package
  const embeddedDir = path.join(ROOT, 'node_modules', '@embedded-postgres');
  if (fs.existsSync(embeddedDir)) {
    for (const entry of fs.readdirSync(embeddedDir)) {
      const candidate = path.join(
        embeddedDir,
        entry,
        'native',
        'bin',
        fileName,
      );
      if (fs.existsSync(candidate)) return candidate;
    }
  }

  throw new Error(
    `Could not locate '${binName}' binary from @embedded-postgres`,
  );
}

/**
 * Terminate all active PostgreSQL backend connections.
 * @param {number} port
 * @returns {Promise<number>} number of connections terminated
 */
async function terminateConnections(port) {
  try {
    ensureDeps('postgres');
    const { Client } = require('pg');
    const client = new Client({
      host: '127.0.0.1',
      port,
      user: PG_DEFAULTS.user,
      password: PG_DEFAULTS.password,
      database: 'postgres',
      connectionTimeoutMillis: 3000,
    });

    await client.connect();

    // Terminate all non-system connections
    const result = await client.query(`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE pid <> pg_backend_pid()
        AND datname IS NOT NULL
    `);

    await client.end();
    return result.rowCount || 0;
  } catch {
    // pg not installed or server not accepting connections
    return 0;
  }
}

/**
 * Stop embedded PostgreSQL daemon if running.
 * Gracefully terminates active connections before shutdown.
 * Uses pg_ctl stop for daemon-mode PG started by startPostgres().
 * @returns {Promise<void>}
 */
async function stopPostgres() {
  const { port } = PG_DEFAULTS;
  const embeddedRunning = await isPortReachable(port);
  const systemRunning = await isPortReachable(PG_DEFAULT_PORT);

  if (!embeddedRunning && !systemRunning) {
    console.log('🐘 No PostgreSQL servers running');
    return;
  }

  if (systemRunning) {
    console.log(
      `🐘 System PostgreSQL on port ${PG_DEFAULT_PORT} is running (not managed by preboot)`,
    );
  }

  if (!embeddedRunning) {
    return;
  }

  try {
    // Step 1: Drain active connections
    const terminated = await terminateConnections(port);
    if (terminated > 0) {
      console.log(`🔌 Terminated ${terminated} active connection(s)`);
    }

    // Step 2: Stop via pg_ctl
    const pgCtl = resolvePgBin('pg_ctl');
    console.log('🐘 Stopping embedded PostgreSQL...');
    execSync(`"${pgCtl}" -D "${PG_DATA_DIR}" -m fast stop`, {
      cwd: ROOT,
      stdio: 'inherit',
      timeout: 15_000,
      shell: true,
    });

    console.log('✅ PostgreSQL stopped');
  } catch (err) {
    console.warn(`⚠️  Could not stop cleanly: ${err.message}`);
    console.warn('   Try manually: kill the process on port 5433');
  }
}

// ─── Main Flows ─────────────────────────────────────────────────────────────

/**
 * Auto mode — runs as pre-hook (predev, pretest, prestart).
 * 1. Ensure .env exists
 * 2. Load environment
 * 3. Detect dialect from XNAPIFY_DB_URL (shorthand or full URL)
 * 4. Install driver deps
 * 5. Resolve server (postgres: priority chain, mysql: reachability check)
 */
async function autoMode() {
  ensureEnvFile();
  loadEnv();

  const url = process.env.XNAPIFY_DB_URL || 'sqlite:database.sqlite';
  const dialect = detectDialect(url);

  ensureDeps(dialect);

  if (dialect === 'postgres') {
    await resolvePostgres(url);
  } else if (dialect === 'mysql') {
    await resolveMysql(url);
  }
}

/** @constant {number} Standard system PostgreSQL port */
const PG_DEFAULT_PORT = 5432;

/**
 * Resolve PostgreSQL connection with priority chain:
 *   1. Configured URL (remote or local) — if reachable, use it
 *   2. Local system PostgreSQL (port 5432) — if running, auto-switch
 *   3. Embedded PostgreSQL (port 5433) — last resort, auto-start
 * @param {string} url - Current XNAPIFY_DB_URL
 */
async function resolvePostgres(url) {
  // Shorthand (e.g. XNAPIFY_DB_URL=postgres) → skip to fallback chain
  if (!url.includes('://')) {
    console.log('🐘 Resolving PostgreSQL server...');
    return pgFallbackChain();
  }

  // ── Priority 1: Configured URL ──
  const cfg = parsePostgresUrl(url);
  if (await isPortReachable(cfg.port, cfg.host)) {
    console.log(`🐘 Using PostgreSQL at ${cfg.host}:${cfg.port}`);
    return;
  }

  // Configured URL not reachable
  if (cfg.host !== '127.0.0.1' && cfg.host !== 'localhost') {
    console.warn(
      `⚠️  Remote PostgreSQL at ${cfg.host}:${cfg.port} not reachable`,
    );
  }

  return pgFallbackChain();
}

/**
 * Fallback chain: local system PG (5432) → embedded PG (5433).
 */
async function pgFallbackChain() {
  // ── Priority 2: Local system PostgreSQL (port 5432) ──
  if (await isPortReachable(PG_DEFAULT_PORT)) {
    const systemUrl = buildPostgresUrl({
      ...PG_DEFAULTS,
      port: PG_DEFAULT_PORT,
    });
    updateEnvDbUrl(systemUrl);
    console.log(`🐘 Using local system PostgreSQL on port ${PG_DEFAULT_PORT}`);
    console.log(`📄 Updated XNAPIFY_DB_URL=${systemUrl}`);
    return;
  }

  // ── Priority 3: Embedded PostgreSQL (port 5433) ──
  const embeddedUrl = buildPostgresUrl(PG_DEFAULTS);
  ensureDeps('_embedded');
  await startPostgres(PG_DEFAULTS);
  updateEnvDbUrl(embeddedUrl);
  console.log(`📄 Updated XNAPIFY_DB_URL=${embeddedUrl}`);
}

// ─── MySQL Resolution ───────────────────────────────────────────────────────

/** @constant {number} Standard MySQL port */
const MYSQL_DEFAULT_PORT = 3306;

/**
 * Parse connection details from a mysql:// URL.
 * @param {string} url
 * @returns {{ host: string, port: number, user: string, database: string }}
 */
function parseMysqlUrl(url) {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || '127.0.0.1',
      port: parseInt(parsed.port, 10) || MYSQL_DEFAULT_PORT,
      user: parsed.username || 'root',
      database: parsed.pathname.replace(/^\//, '') || '',
    };
  } catch {
    return {
      host: '127.0.0.1',
      port: MYSQL_DEFAULT_PORT,
      user: 'root',
      database: '',
    };
  }
}

/**
 * Resolve MySQL connection:
 *   - Shorthand (XNAPIFY_DB_URL=mysql): check localhost:3306
 *   - Full URL: check if server is reachable
 * No embedded MySQL — warn if unreachable.
 * @param {string} url
 */
async function resolveMysql(url) {
  // Shorthand — check local MySQL
  if (!url.includes('://')) {
    if (await isPortReachable(MYSQL_DEFAULT_PORT)) {
      console.log(`🐬 Using local MySQL on port ${MYSQL_DEFAULT_PORT}`);
      console.log(
        '📄 Set XNAPIFY_DB_URL=mysql://user:pass@127.0.0.1:3306/dbname',
      );
    } else {
      console.warn(`⚠️  MySQL not found on port ${MYSQL_DEFAULT_PORT}`);
      console.warn(
        '   Install MySQL/MariaDB and set XNAPIFY_DB_URL to a full URL',
      );
    }
    return;
  }

  // Full URL — verify reachability
  const cfg = parseMysqlUrl(url);
  if (await isPortReachable(cfg.port, cfg.host)) {
    console.log(`🐬 Using MySQL at ${cfg.host}:${cfg.port}`);
  } else {
    console.warn(`⚠️  MySQL at ${cfg.host}:${cfg.port} is not reachable`);
  }
}

/**
 * Show current database status.
 */
async function showStatus() {
  ensureEnvFile();
  loadEnv();

  const url = process.env.XNAPIFY_DB_URL || 'sqlite:database.sqlite';
  const dialect = detectDialect(url);
  const systemPg = await isPortReachable(PG_DEFAULT_PORT);
  const embeddedPg = await isPortReachable(PG_DEFAULTS.port);

  const separator = '─'.repeat(50);

  console.log(separator);
  console.log('📊 Database Status');
  console.log(separator);
  console.log(`   Dialect  : ${dialect}`);
  console.log(`   URL      : ${url}`);
  console.log(
    `   System PG: ${systemPg ? '🟢 Running' : '🔴 Stopped'} (port ${PG_DEFAULT_PORT})`,
  );
  console.log(
    `   Embed  PG: ${embeddedPg ? '🟢 Running' : '🔴 Stopped'} (port ${PG_DEFAULTS.port})`,
  );
  console.log(`   PG Data  : ${PG_DATA_DIR}`);
  console.log(separator);

  // Check if deps are installed
  const deps = DIALECT_DEPS[dialect] || [];
  const installed = deps.filter(d => {
    try {
      require.resolve(d.name);
      return true;
    } catch {
      return false;
    }
  });

  if (installed.length === deps.length) {
    console.log(
      `   Deps     : ✅ All installed (${deps.map(d => d.name).join(', ')})`,
    );
  } else {
    const missing = deps.filter(d => !installed.includes(d));
    console.log(
      `   Deps     : ⚠️  Missing: ${missing.map(d => d.name).join(', ')} (auto-installed on next boot)`,
    );
  }
  console.log(separator);
}

// ─── CLI Entry ──────────────────────────────────────────────────────────────

/**
 * Print usage help.
 */
function showHelp() {
  console.log(`
Usage: node tools/npm/preboot.js [command]

Commands:
  (none)      Auto mode — detect dialect, install deps, resolve server
  --start     Start embedded PostgreSQL daemon
  --stop      Stop embedded PostgreSQL daemon (drains connections)
  --status    Show database status
  --help      Show this help

Environment:
  XNAPIFY_DB_URL   Database URL or shorthand (sqlite, postgres, mysql)
`);
}

const args = process.argv.slice(2);
const flag = args.find(a => a.startsWith('--'));

const COMMANDS = {
  '--start': async () => {
    ensureEnvFile();
    loadEnv();
    ensureDeps('postgres');
    ensureDeps('_embedded');
    return startPostgres(PG_DEFAULTS);
  },
  '--stop': stopPostgres,
  '--status': showStatus,
  '--help': async () => showHelp(),
};

const run = COMMANDS[flag] || autoMode;

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(`❌ Preboot failed: ${err.message}`);
    if (process.env.LOG_VERBOSE === 'true') {
      console.error(err.stack);
    }
    process.exit(1);
  });
