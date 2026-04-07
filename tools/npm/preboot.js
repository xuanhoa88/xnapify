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
 * Auto mode (no flags): ensure .env → install driver → resolve DB server
 * Manual mode: node tools/npm/preboot.js [--db <type>] --start | --stop | --status
 *
 * Supported embedded databases:
 *   - PostgreSQL (via @embedded-postgres platform packages)
 *   - MySQL 8.4 LTS (via portable binary download from dev.mysql.com)
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
const ENV_LOCAL_PATH = path.join(ROOT, '.env.local');
const ENV_TEMPLATE = path.join(ROOT, '.env.xnapify');

/**
 * When true, DB URL writes go to .env.local (session override)
 * instead of .env (persistent). Set when --db or XNAPIFY_DB is used.
 */
let useLocalEnv = false;
const PG_DATA_DIR =
  process.env.XNAPIFY_PG_DATA_DIR ||
  (process.env.NODE_ENV === 'production'
    ? path.join(os.homedir(), '.xnapify', 'postgres')
    : path.join(ROOT, '.data', 'postgres'));

const PG_DEFAULTS = {
  port: 5433,
  user: 'postgres',
  password: 'postgres',
  database: 'xnapify_dev',
};

const MYSQL_VERSION = '8.4.8';
const MYSQL_EMBEDDED_PORT = 3307;
const MYSQL_DATA_DIR =
  process.env.XNAPIFY_MYSQL_DATA_DIR ||
  (process.env.NODE_ENV === 'production'
    ? path.join(os.homedir(), '.xnapify', 'mysql')
    : path.join(ROOT, '.data', 'mysql'));

const MYSQL_DEFAULTS = {
  port: MYSQL_EMBEDDED_PORT,
  user: 'root',
  password: '',
  database: 'xnapify_dev',
};

/** @constant {number} Standard system PostgreSQL port */
const PG_DEFAULT_PORT = 5432;
/** @constant {number} Standard system MySQL port */
const MYSQL_DEFAULT_PORT = 3306;

const DIALECT_DEPS = (() => {
  const platMap = { darwin: 'darwin', linux: 'linux', win32: 'windows' };
  const archMap = { x64: 'x64', arm64: 'arm64' };
  const platKey = platMap[os.platform()] || os.platform();
  const archKey = archMap[os.arch()] || os.arch();
  const embeddedPkg = `@embedded-postgres/${platKey}-${archKey}`;

  return {
    // Pin sqlite3@5 — v6+ requires Node >= 20
    sqlite: [{ name: 'sqlite3', spec: 'sqlite3@^5.1.7' }],
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
 * Update XNAPIFY_DB_URL in the appropriate env file.
 *
 * When `useLocalEnv` is true (--db / XNAPIFY_DB override), writes to
 * `.env.local` so the override is session-scoped and does NOT mutate
 * the user's `.env`. dotenv-flow reads `.env.local` automatically and
 * it takes precedence over `.env`.
 *
 * When `useLocalEnv` is false (normal auto mode), writes to `.env`
 * for persistent configuration.
 *
 * @param {string} newUrl - New database URL value
 */
function updateEnvDbUrl(newUrl) {
  const targetFile = useLocalEnv ? ENV_LOCAL_PATH : ENV_PATH;

  // For .env.local — simple: just write/replace the single variable
  if (useLocalEnv) {
    upsertEnvVar(targetFile, 'XNAPIFY_DB_URL', newUrl);
    return;
  }

  // For .env — existing behavior: create from template if missing
  ensureEnvFile();

  if (!fs.existsSync(targetFile)) {
    fs.writeFileSync(targetFile, `XNAPIFY_DB_URL=${newUrl}\n`, 'utf-8');
    return;
  }

  upsertEnvVar(targetFile, 'XNAPIFY_DB_URL', newUrl);
}

/**
 * Upsert a KEY=VALUE in an env file. Creates the file if missing.
 * @param {string} filePath - Path to the env file
 * @param {string} key - Environment variable name
 * @param {string} value - New value
 */
function upsertEnvVar(filePath, key, value) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, `${key}=${value}\n`, 'utf-8');
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const pattern = new RegExp(`^${key}=.*`, 'm');

  if (pattern.test(content)) {
    const updated = content.replace(pattern, `${key}=${value}`);
    fs.writeFileSync(filePath, updated, 'utf-8');
  } else {
    const separator = content.endsWith('\n') ? '' : '\n';
    fs.writeFileSync(
      filePath,
      `${content}${separator}${key}=${value}\n`,
      'utf-8',
    );
  }
}

/**
 * Remove XNAPIFY_DB_URL from .env.local (cleanup after override session).
 * Deletes the file entirely if XNAPIFY_DB_URL was the only content.
 */
function cleanupEnvLocal() {
  if (!fs.existsSync(ENV_LOCAL_PATH)) return;

  const content = fs.readFileSync(ENV_LOCAL_PATH, 'utf-8');
  const cleaned = content.replace(/^XNAPIFY_DB_URL=.*\n?/m, '');

  if (cleaned.trim() === '') {
    fs.unlinkSync(ENV_LOCAL_PATH);
  } else {
    fs.writeFileSync(ENV_LOCAL_PATH, cleaned, 'utf-8');
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

  let attempts = 0;
  const maxAttempts = 3;
  let success = false;
  let lastError = null;

  while (attempts < maxAttempts) {
    try {
      const buildOpts =
        dialect === 'sqlite' ? ['--build-from-source=sqlite3'] : [];

      const env = { ...process.env };

      // Add NODE_DIR to env
      if (process.env.XNAPIFY_NODE_DIR) {
        env.npm_config_nodedir = process.env.XNAPIFY_NODE_DIR;
      }

      // --- ISOLATED SANDBOX ARCHITECTURE ---
      // Execute the database backend install locked cleanly inside a .data sandbox
      // to guarantee NPM v9+ never traverses into the project root and drops packages
      const driverDir = path.join(ROOT, '.data', 'sequelize-drivers');
      if (!fs.existsSync(driverDir))
        fs.mkdirSync(driverDir, { recursive: true });

      // Force a dummy package.json to disable NPM upward traversal hooks
      fs.writeFileSync(
        path.join(driverDir, 'package.json'),
        JSON.stringify(
          {
            name: `@xnapify-sandbox/${dialect}`,
            version: '1.0.0',
            private: true,
          },
          null,
          2,
        ),
      );

      execSync(
        `npm install --no-save --prefix "${driverDir}" ${[...specs, ...buildOpts].join(' ')}`,
        {
          env,
          cwd: driverDir,
          stdio: 'pipe',
          timeout: 300_000,
          shell: os.platform() === 'win32' ? 'powershell.exe' : true,
        },
      );

      // Bind the securely compiled library back natively into module resolution
      // using directory junctions (admin bypasses Windows symlink restriction).
      names.forEach(name => {
        const srcPath = path.join(driverDir, 'node_modules', name);
        const destPath = path.join(ROOT, 'node_modules', name);

        // Clear previous corrupted or orphaned directory paths
        fs.rmSync(destPath, { recursive: true, force: true });
        fs.symlinkSync(srcPath, destPath, 'junction');
      });

      success = true;
      break;
    } catch (err) {
      attempts++;
      lastError = err;
      const message = err.stderr ? err.stderr.toString().trim() : err.message;
      if (attempts < maxAttempts) {
        console.warn(
          `\n⚠️  [Attempt ${attempts}/${maxAttempts}] Install failed: ${message}`,
        );
        console.warn(`   Retrying in 5 seconds...\n`);
        execSync(
          os.platform() === 'win32' ? 'timeout /t 5 /nobreak > NUL' : 'sleep 5',
          { shell: true },
        );
      }
    }
  }

  if (!success) {
    const message = lastError.stderr
      ? lastError.stderr.toString().trim()
      : lastError.message;
    throw new Error(
      `Failed to install ${dialect} deps after ${maxAttempts} attempts: ${message}`,
    );
  }
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
  const user = encodeURIComponent(cfg.user || PG_DEFAULTS.user);
  const password = encodeURIComponent(cfg.password || PG_DEFAULTS.password);
  const port = cfg.port || PG_DEFAULTS.port;
  const database = encodeURIComponent(cfg.database || PG_DEFAULTS.database);
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

// ─── MySQL Lifecycle ────────────────────────────────────────────────────────

/**
 * Get platform-specific MySQL download info.
 * @returns {{ url: string, dirName: string, archiveExt: string }}
 */
function getMysqlDownloadInfo() {
  const plat = os.platform();
  const arch = os.arch();
  const ver = MYSQL_VERSION;
  const base = `https://dev.mysql.com/get/Downloads/MySQL-8.4`;

  /** @type {Record<string, Record<string, { url: string, dirName: string, archiveExt: string }>>} */
  const matrix = {
    linux: {
      x64: {
        url: `${base}/mysql-${ver}-linux-glibc2.28-x86_64.tar.xz`,
        dirName: `mysql-${ver}-linux-glibc2.28-x86_64`,
        archiveExt: '.tar.xz',
      },
      arm64: {
        url: `${base}/mysql-${ver}-linux-glibc2.28-aarch64.tar.xz`,
        dirName: `mysql-${ver}-linux-glibc2.28-aarch64`,
        archiveExt: '.tar.xz',
      },
    },
    darwin: {
      arm64: {
        url: `${base}/mysql-${ver}-macos15-arm64.tar.gz`,
        dirName: `mysql-${ver}-macos15-arm64`,
        archiveExt: '.tar.gz',
      },
      x64: {
        url: `${base}/mysql-${ver}-macos15-x86_64.tar.gz`,
        dirName: `mysql-${ver}-macos15-x86_64`,
        archiveExt: '.tar.gz',
      },
    },
    win32: {
      x64: {
        url: `${base}/mysql-${ver}-winx64.zip`,
        dirName: `mysql-${ver}-winx64`,
        archiveExt: '.zip',
      },
    },
  };

  const platInfo = matrix[plat];
  if (!platInfo) {
    throw new Error(`Unsupported platform for embedded MySQL: ${plat}`);
  }
  const archInfo = platInfo[arch];
  if (!archInfo) {
    throw new Error(
      `Unsupported architecture for embedded MySQL: ${plat}/${arch}`,
    );
  }
  return archInfo;
}

/**
 * Download a file via curl (or PowerShell on Windows).
 *
 * We use an external tool instead of Node.js built-in `https` because
 * some CDNs (e.g. dev.mysql.com) require HTTP/2 for proper redirect
 * negotiation, which the Node.js http/https modules do not support.
 *
 * @param {string} url - URL to download
 * @param {string} dest - Destination file path
 * @returns {Promise<void>}
 */
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const isWin = os.platform() === 'win32';

    // Build download command — curl on Unix/macOS, PowerShell on Windows
    const cmd = isWin
      ? `powershell -Command "Invoke-WebRequest -Uri '${url}' -OutFile '${dest}' -UseBasicParsing"`
      : `curl -fSL --retry 3 --retry-delay 5 -o "${dest}" "${url}"`;

    console.log(`   📥 Downloading from ${new URL(url).hostname}...`);

    try {
      execSync(cmd, {
        cwd: ROOT,
        stdio: 'inherit',
        timeout: 600_000, // 10 min for large MySQL archives
        shell: true,
      });
      if (!fs.existsSync(dest)) {
        return reject(
          new Error(`Download completed but file not found: ${dest}`),
        );
      }
      resolve();
    } catch (err) {
      // Cleanup partial downloads
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
      reject(new Error(`Download failed from ${url}: ${err.message}`));
    }
  });
}

/**
 * Extract an archive to a destination directory.
 * Supports .tar.gz, .tar.xz (via tar) and .zip (via PowerShell on Windows,
 * bsdtar/unzip on Unix).
 * @param {string} archivePath
 * @param {string} destDir
 */
function extractArchive(archivePath, destDir) {
  fs.mkdirSync(destDir, { recursive: true });

  if (archivePath.endsWith('.zip')) {
    if (os.platform() === 'win32') {
      execSync(
        `powershell -Command "Expand-Archive -Path '${archivePath}' -DestinationPath '${destDir}' -Force"`,
        { stdio: 'inherit', timeout: 120_000, shell: true },
      );
    } else {
      // macOS bsdtar handles .zip natively; fall back to unzip if needed
      try {
        execSync(`tar xf "${archivePath}" -C "${destDir}"`, {
          stdio: 'inherit',
          timeout: 120_000,
          shell: true,
        });
      } catch {
        execSync(`unzip -qo "${archivePath}" -d "${destDir}"`, {
          stdio: 'inherit',
          timeout: 120_000,
          shell: true,
        });
      }
    }
  } else {
    // .tar.gz or .tar.xz
    if (archivePath.endsWith('.tar.xz')) {
      // Verify xz is available (not present on Alpine/slim Docker images)
      try {
        execSync('xz --version', { stdio: 'pipe', timeout: 5_000 });
      } catch {
        throw new Error(
          "Extraction of .tar.xz requires 'xz'. Install with: apt-get install xz-utils",
        );
      }
    }
    execSync(`tar xf "${archivePath}" -C "${destDir}"`, {
      stdio: 'inherit',
      timeout: 300_000, // 5 min — MySQL archives are 300–600 MB
      shell: true,
    });
  }
}

/**
 * Ensure MySQL binaries are downloaded and extracted.
 * Idempotent — skips if basedir already exists.
 * @returns {string} basedir — path to extracted MySQL directory
 */
async function ensureMysqlBinaries() {
  const info = getMysqlDownloadInfo();
  const basedir = path.join(MYSQL_DATA_DIR, info.dirName);
  const mysqldBin = path.join(
    basedir,
    'bin',
    os.platform() === 'win32' ? 'mysqld.exe' : 'mysqld',
  );

  if (fs.existsSync(mysqldBin)) return basedir;

  console.log(
    `🐬 Downloading MySQL ${MYSQL_VERSION} for ${os.platform()}/${os.arch()}...`,
  );
  fs.mkdirSync(MYSQL_DATA_DIR, { recursive: true });

  const archiveName = `mysql-${MYSQL_VERSION}${info.archiveExt}`;
  const archivePath = path.join(MYSQL_DATA_DIR, archiveName);

  try {
    await downloadFile(info.url, archivePath);
    console.log('📦 Extracting MySQL binaries...');
    extractArchive(archivePath, MYSQL_DATA_DIR);

    // Cleanup archive
    fs.unlinkSync(archivePath);

    if (!fs.existsSync(mysqldBin)) {
      throw new Error(
        `Extraction completed but mysqld not found at ${mysqldBin}`,
      );
    }

    // Ensure bin executables are executable on Unix
    if (os.platform() !== 'win32') {
      const binDir = path.join(basedir, 'bin');
      for (const file of fs.readdirSync(binDir)) {
        fs.chmodSync(path.join(binDir, file), 0o755);
      }
    }

    console.log('✅ MySQL binaries ready');
  } catch (err) {
    // Cleanup partial downloads
    if (fs.existsSync(archivePath)) fs.unlinkSync(archivePath);
    throw err;
  }

  return basedir;
}

/**
 * Resolve a MySQL binary path from the extracted installation.
 * @param {string} binName - Binary name (e.g. 'mysqld', 'mysqladmin', 'mysql')
 * @returns {string} Absolute path to the binary
 */
function resolveMysqlBin(binName) {
  const isWin = os.platform() === 'win32';
  const fileName = isWin ? `${binName}.exe` : binName;

  const info = getMysqlDownloadInfo();
  const basedir = path.join(MYSQL_DATA_DIR, info.dirName);
  const bin = path.join(basedir, 'bin', fileName);

  if (fs.existsSync(bin)) return bin;

  // Fallback: scan top-level dirs in MYSQL_DATA_DIR for any mysql-* directory
  if (fs.existsSync(MYSQL_DATA_DIR)) {
    for (const entry of fs.readdirSync(MYSQL_DATA_DIR)) {
      if (!entry.startsWith('mysql-')) continue;
      const candidate = path.join(MYSQL_DATA_DIR, entry, 'bin', fileName);
      if (fs.existsSync(candidate)) return candidate;
    }
  }

  throw new Error(
    `Could not locate '${binName}' binary. Run with --db mysql --start to download.`,
  );
}

/**
 * Generate my.cnf for portable MySQL operation.
 * @param {{ port?: number }} [cfg]
 * @param {string} basedir - Path to extracted MySQL directory
 * @returns {string} Path to generated my.cnf
 */
function generateMyCnf(cfg = MYSQL_DEFAULTS, basedir) {
  const port = cfg.port || MYSQL_DEFAULTS.port;
  // MySQL my.cnf requires forward slashes even on Windows
  const fwd = p => p.replace(/\\/g, '/');
  const datadir = path.join(MYSQL_DATA_DIR, 'data');
  const socketPath = path.join(MYSQL_DATA_DIR, 'mysql.sock');
  const pidFile = path.join(MYSQL_DATA_DIR, 'mysql.pid');
  const errorLog = path.join(MYSQL_DATA_DIR, 'error.log');
  const cnfPath = path.join(MYSQL_DATA_DIR, 'my.cnf');

  const content = `# Auto-generated by xnapify preboot — do not edit manually
[mysqld]
basedir       = ${fwd(basedir)}
datadir       = ${fwd(datadir)}
port          = ${port}
socket        = ${fwd(socketPath)}
pid-file      = ${fwd(pidFile)}
log-error     = ${fwd(errorLog)}
bind-address  = 127.0.0.1
mysqlx        = 0
skip-name-resolve

# Character set
character-set-server = utf8mb4
collation-server = utf8mb4_0900_ai_ci

# Performance (conservative dev defaults)
innodb_buffer_pool_size = 128M
innodb_redo_log_capacity = 96M
innodb_flush_log_at_trx_commit = 2
max_connections = 100

[client]
socket        = ${fwd(socketPath)}
port          = ${port}
`;

  fs.writeFileSync(cnfPath, content, 'utf-8');
  return cnfPath;
}

/**
 * Build a mysql:// URL from config.
 * @param {{ user: string, password: string, port: number, database: string }} cfg
 * @returns {string}
 */
function buildMysqlUrl(cfg) {
  const user = encodeURIComponent(cfg.user || MYSQL_DEFAULTS.user);
  const password = cfg.password || MYSQL_DEFAULTS.password;
  const port = cfg.port || MYSQL_DEFAULTS.port;
  const database = encodeURIComponent(cfg.database || MYSQL_DEFAULTS.database);
  const auth = password ? `${user}:${encodeURIComponent(password)}` : user;
  return `mysql://${auth}@127.0.0.1:${port}/${database}`;
}

/**
 * Start embedded MySQL daemon. Idempotent — checks port first.
 *
 * Downloads MySQL binaries from dev.mysql.com, initialises data directory
 * via mysqld --initialize-insecure, writes my.cnf, and starts the daemon.
 *
 * @param {{ port?: number, user?: string, password?: string, database?: string }} [cfg]
 * @returns {Promise<void>}
 */
async function startMysql(cfg = MYSQL_DEFAULTS) {
  const port = cfg.port || MYSQL_DEFAULTS.port;

  if (await isPortReachable(port)) {
    console.log(`🐬 MySQL already running on port ${port}`);
    return;
  }

  console.log(`🐬 Starting embedded MySQL on port ${port}...`);

  // Step 1: Ensure binaries are downloaded
  const basedir = await ensureMysqlBinaries();
  const mysqld = resolveMysqlBin('mysqld');
  const datadir = path.join(MYSQL_DATA_DIR, 'data');

  // Step 2: Initialise data directory (idempotent — skip if already exists)
  if (!fs.existsSync(path.join(datadir, 'mysql'))) {
    console.log('🐬 Initialising MySQL data directory...');
    fs.mkdirSync(datadir, { recursive: true });
    const initArgs = [
      '--no-defaults',
      '--initialize-insecure',
      `--basedir=${basedir}`,
      `--datadir=${datadir}`,
    ];
    // --user is Unix-only; Windows ignores it and usernames may have spaces
    if (os.platform() !== 'win32') {
      initArgs.push(`--user=${os.userInfo().username}`);
    }
    execSync(`"${mysqld}" ${initArgs.join(' ')}`, {
      cwd: ROOT,
      stdio: 'inherit',
      timeout: 60_000,
      shell: true,
    });
  }

  // Step 3: Generate my.cnf
  const cnfPath = generateMyCnf(cfg, basedir);

  // Step 4: Clean up stale socket from previous crash (Unix only)
  const socketPath = path.join(MYSQL_DATA_DIR, 'mysql.sock');
  if (
    os.platform() !== 'win32' &&
    fs.existsSync(socketPath) &&
    !(await isPortReachable(port))
  ) {
    fs.unlinkSync(socketPath);
  }

  // Step 5: Start daemon
  if (os.platform() === 'win32') {
    // Windows: start detached
    execSync(`start /B "" "${mysqld}" --defaults-file="${cnfPath}"`, {
      cwd: ROOT,
      stdio: 'ignore',
      timeout: 10_000,
      shell: true,
    });
  } else {
    // Unix: use --daemonize (MySQL 8.4+ built-in)
    execSync(`"${mysqld}" --defaults-file="${cnfPath}" --daemonize`, {
      cwd: ROOT,
      stdio: 'inherit',
      timeout: 30_000,
      shell: true,
    });
  }

  // Step 5: Wait for MySQL to become reachable
  const maxWait = 15_000;
  const start = Date.now();
  while (!(await isPortReachable(port)) && Date.now() - start < maxWait) {
    await new Promise(r => setTimeout(r, 300));
  }

  if (!(await isPortReachable(port))) {
    const errorLog = path.join(MYSQL_DATA_DIR, 'error.log');
    if (fs.existsSync(errorLog)) {
      const tail = fs
        .readFileSync(errorLog, 'utf-8')
        .split('\n')
        .slice(-10)
        .join('\n');
      console.error(`Last 10 lines of error.log:\n${tail}`);
    }
    throw new Error(`MySQL did not become reachable on port ${port}`);
  }

  // Step 7: Grant TCP access + create database (idempotent)
  // --initialize-insecure creates root@localhost (socket only). Sequelize
  // connects via TCP (host: 127.0.0.1) which MySQL treats as a different
  // user. We use the mysql CLI over socket to bootstrap root@'%'.
  const dbName = cfg.database || MYSQL_DEFAULTS.database;
  try {
    const mysqlCli = resolveMysqlBin('mysql');
    const socketPath = path.join(MYSQL_DATA_DIR, 'mysql.sock');
    const connectArgs =
      os.platform() === 'win32'
        ? `--host=127.0.0.1 --port=${port}`
        : `--socket="${socketPath}"`;
    const baseCmd = `"${mysqlCli}" ${connectArgs} --user=root`;

    // Write setup SQL to a temp file to avoid shell escaping issues
    // with backticks, single quotes, and empty strings.
    const sqlFile = path.join(MYSQL_DATA_DIR, '_setup.sql');
    fs.writeFileSync(
      sqlFile,
      [
        "CREATE USER IF NOT EXISTS 'root'@'%' IDENTIFIED BY '';",
        "GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' WITH GRANT OPTION;",
        'FLUSH PRIVILEGES;',
        `CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`,
      ].join('\n'),
      'utf-8',
    );
    execSync(`${baseCmd} < "${sqlFile}"`, {
      cwd: ROOT,
      stdio: 'pipe',
      timeout: 10_000,
      shell: true,
    });
    fs.unlinkSync(sqlFile);

    // Populate timezone tables so SET time_zone = 'UTC' works.
    // Portable MySQL doesn't ship with timezone data loaded.
    const zoneinfoDir = '/usr/share/zoneinfo';
    if (os.platform() !== 'win32' && fs.existsSync(zoneinfoDir)) {
      try {
        const tzSql = resolveMysqlBin('mysql_tzinfo_to_sql');
        execSync(`"${tzSql}" "${zoneinfoDir}" | ${baseCmd} mysql`, {
          cwd: ROOT,
          stdio: 'pipe',
          timeout: 30_000,
          shell: true,
        });
      } catch {
        // Non-fatal — offset format (+00:00) still works
      }
    }
  } catch (err) {
    // Non-fatal — grants might already exist
    const msg = err.stderr ? err.stderr.toString().trim() : err.message;
    if (msg) console.warn(`   ⚠️  MySQL setup: ${msg}`);
  }

  console.log(
    `✅ MySQL ready — ${buildMysqlUrl({ ...MYSQL_DEFAULTS, ...cfg })}`,
  );
}

/**
 * Stop embedded MySQL daemon if running.
 * Uses mysqladmin shutdown for graceful stop.
 * @returns {Promise<void>}
 */
async function stopMysql() {
  const embeddedPort = MYSQL_DEFAULTS.port;
  const embeddedRunning = await isPortReachable(embeddedPort);
  const systemRunning = await isPortReachable(MYSQL_DEFAULT_PORT);

  if (!embeddedRunning && !systemRunning) {
    console.log('🐬 No MySQL servers running');
    return;
  }

  if (systemRunning) {
    console.log(
      `🐬 System MySQL on port ${MYSQL_DEFAULT_PORT} is running (not managed by preboot)`,
    );
  }

  if (!embeddedRunning) {
    return;
  }

  try {
    const socketPath = path.join(MYSQL_DATA_DIR, 'mysql.sock');
    const mysqladmin = resolveMysqlBin('mysqladmin');
    console.log('🐬 Stopping embedded MySQL...');

    const shutdownArgs = [
      `--user=${MYSQL_DEFAULTS.user}`,
      `--port=${embeddedPort}`,
      'shutdown',
    ];
    // Prefer socket on Unix for reliability
    if (os.platform() !== 'win32' && fs.existsSync(socketPath)) {
      shutdownArgs.unshift(`--socket=${socketPath}`);
    }

    execSync(`"${mysqladmin}" ${shutdownArgs.join(' ')}`, {
      cwd: ROOT,
      stdio: 'inherit',
      timeout: 15_000,
      shell: true,
    });

    // Wait for port to become unreachable
    const maxWait = 5_000;
    const start = Date.now();
    while (
      (await isPortReachable(embeddedPort)) &&
      Date.now() - start < maxWait
    ) {
      await new Promise(r => setTimeout(r, 300));
    }

    console.log('✅ MySQL stopped');
  } catch (err) {
    console.warn(`⚠️  Could not stop cleanly: ${err.message}`);
    console.warn(`   Try manually: kill the process on port ${embeddedPort}`);
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
 *
 * In test context (pretest / NODE_ENV=test) always uses SQLite for speed
 * and isolation — tests should not depend on an external database server.
 */
async function autoMode() {
  ensureEnvFile();
  loadEnv();

  // Force SQLite for tests — fast, in-process, no server required.
  // npm sets npm_lifecycle_event=pretest when running the pretest hook.
  const isTest =
    process.env.NODE_ENV === 'test' ||
    (process.env.npm_lifecycle_event || '').includes('test');

  if (isTest) {
    const dialect = 'sqlite';
    ensureDeps(dialect);
    console.log('🧪 Test mode — using SQLite (in-memory)');
    return;
  }

  // --db <type> overrides XNAPIFY_DB_URL dialect detection
  const url =
    dbOverride || process.env.XNAPIFY_DB_URL || 'sqlite:database.sqlite';
  const dialect = detectDialect(url);

  ensureDeps(dialect);

  if (dialect === 'postgres') {
    await resolvePostgres(url);
  } else if (dialect === 'mysql') {
    await resolveMysql(url);
  } else if (dialect === 'sqlite' && dbOverride) {
    // Override active (--db sqlite / XNAPIFY_DB=sqlite) — write the SQLite
    // URL to .env.local so it takes precedence over any existing
    // postgres/mysql URL in .env or .env.local.
    const sqliteUrl = 'sqlite:database.sqlite';
    updateEnvDbUrl(sqliteUrl);
    console.log(`📄 Updated XNAPIFY_DB_URL=${sqliteUrl}`);
  }
}

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

/**
 * Parse connection details from a mysql:// URL.
 * @param {string} url
 * @returns {{ host: string, port: number, user: string, password: string, database: string }}
 */
function parseMysqlUrl(url) {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || '127.0.0.1',
      port: parseInt(parsed.port, 10) || MYSQL_DEFAULT_PORT,
      user: parsed.username || 'root',
      password: parsed.password || '',
      database: parsed.pathname.replace(/^\//, '') || '',
    };
  } catch {
    return {
      host: '127.0.0.1',
      port: MYSQL_DEFAULT_PORT,
      user: 'root',
      password: '',
      database: '',
    };
  }
}

/**
 * Resolve MySQL connection with priority chain:
 *   1. Configured URL (remote or local) — if reachable, use it
 *   2. Local system MySQL/MariaDB (port 3306) — if running, auto-switch
 *   3. Embedded MySQL (port 3307) — last resort, auto-start
 * @param {string} url - Current XNAPIFY_DB_URL
 */
async function resolveMysql(url) {
  // Shorthand (e.g. XNAPIFY_DB_URL=mysql) → skip to fallback chain
  if (!url.includes('://')) {
    console.log('🐬 Resolving MySQL server...');
    return mysqlFallbackChain();
  }

  // ── Priority 1: Configured URL ──
  const cfg = parseMysqlUrl(url);
  if (await isPortReachable(cfg.port, cfg.host)) {
    console.log(`🐬 Using MySQL at ${cfg.host}:${cfg.port}`);
    return;
  }

  // Configured URL not reachable
  if (cfg.host !== '127.0.0.1' && cfg.host !== 'localhost') {
    console.warn(`⚠️  Remote MySQL at ${cfg.host}:${cfg.port} not reachable`);
  }

  return mysqlFallbackChain();
}

/**
 * Fallback chain: local system MySQL (3306) → embedded MySQL (3307).
 */
async function mysqlFallbackChain() {
  // ── Priority 2: Local system MySQL/MariaDB (port 3306) ──
  if (await isPortReachable(MYSQL_DEFAULT_PORT)) {
    const systemUrl = buildMysqlUrl({
      ...MYSQL_DEFAULTS,
      port: MYSQL_DEFAULT_PORT,
    });
    updateEnvDbUrl(systemUrl);
    console.log(`🐬 Using local system MySQL on port ${MYSQL_DEFAULT_PORT}`);
    console.log(`📄 Updated XNAPIFY_DB_URL=${systemUrl}`);
    return;
  }

  // ── Priority 3: Embedded MySQL (port 3307) ──
  const embeddedUrl = buildMysqlUrl(MYSQL_DEFAULTS);
  await startMysql(MYSQL_DEFAULTS);
  updateEnvDbUrl(embeddedUrl);
  console.log(`📄 Updated XNAPIFY_DB_URL=${embeddedUrl}`);
}

/**
 * Show database status — dialect-aware.
 * @param {string} [dialectOverride] - Optional dialect override from --db flag
 */
async function showStatus(dialectOverride) {
  ensureEnvFile();
  loadEnv();

  const url = process.env.XNAPIFY_DB_URL || 'sqlite:database.sqlite';
  const dialect = dialectOverride || detectDialect(url);
  const separator = '─'.repeat(50);

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
  const depsLine =
    installed.length === deps.length
      ? `✅ All installed (${deps.map(d => d.name).join(', ')})`
      : `⚠️  Missing: ${deps
          .filter(d => !installed.includes(d))
          .map(d => d.name)
          .join(', ')} (auto-installed on next boot)`;

  console.log(separator);

  if (dialect === 'postgres') {
    const systemPg = await isPortReachable(PG_DEFAULT_PORT);
    const embeddedPg = await isPortReachable(PG_DEFAULTS.port);
    console.log('📊 Database Status (PostgreSQL)');
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
  } else if (dialect === 'mysql') {
    const systemMy = await isPortReachable(MYSQL_DEFAULT_PORT);
    const embeddedMy = await isPortReachable(MYSQL_EMBEDDED_PORT);
    console.log('📊 Database Status (MySQL)');
    console.log(separator);
    console.log(`   Dialect   : ${dialect}`);
    console.log(`   URL       : ${url}`);
    console.log(
      `   System SQL: ${systemMy ? '🟢 Running' : '🔴 Stopped'} (port ${MYSQL_DEFAULT_PORT})`,
    );
    console.log(
      `   Embed  SQL: ${embeddedMy ? '🟢 Running' : '🔴 Stopped'} (port ${MYSQL_EMBEDDED_PORT})`,
    );
    console.log(`   MySQL Data: ${MYSQL_DATA_DIR}`);
  } else {
    console.log('📊 Database Status (SQLite)');
    console.log(separator);
    console.log(`   Dialect  : ${dialect}`);
    console.log(`   URL      : ${url}`);
    console.log('   Mode     : In-process (no daemon)');
  }

  console.log(`   Deps     : ${depsLine}`);
  console.log(separator);
}

// ─── CLI Entry ──────────────────────────────────────────────────────────────

/**
 * Print usage help.
 */
function showHelp() {
  console.log(`
Usage: node tools/npm/preboot.js [options] [command]

Commands:
  (none)      Auto mode — detect dialect, install deps, resolve server
  --start     Start embedded database daemon (auto-detects from XNAPIFY_DB_URL)
  --stop      Stop embedded database daemon (auto-detects from XNAPIFY_DB_URL)
  --status    Show database status (auto-detects from XNAPIFY_DB_URL)
  --help      Show this help

Options:
  --db <type> Override database type (postgres, mysql, sqlite)
              Takes precedence over XNAPIFY_DB_URL detection

Environment:
  XNAPIFY_DB_URL   Database URL or shorthand (sqlite, postgres, mysql)
  XNAPIFY_DB       Override dialect (same as --db, for npm lifecycle hooks)

Examples:
  node tools/npm/preboot.js --start              # start DB detected from env
  node tools/npm/preboot.js --db mysql --start   # force MySQL start
  node tools/npm/preboot.js --db postgres --stop  # force PostgreSQL stop
  XNAPIFY_DB=mysql npm run dev                   # dev with MySQL
  XNAPIFY_DB=postgres npm start                  # start with PostgreSQL
`);
}

/**
 * Resolve the active dialect from --db flag or environment.
 * @param {string|null} dbOverride - Value of --db flag, or null
 * @returns {string} 'sqlite' | 'postgres' | 'mysql'
 */
function resolveDialect(dbOverride) {
  if (dbOverride) return dbOverride;
  ensureEnvFile();
  loadEnv();
  return detectDialect(process.env.XNAPIFY_DB_URL || '');
}

// Parse CLI arguments
// --db <type> or XNAPIFY_DB env var overrides dialect detection.
// XNAPIFY_DB env works with npm lifecycle hooks (predev/prestart)
// where CLI args are not forwarded.
const args = process.argv.slice(2);
const dbIdx = args.indexOf('--db');
const dbOverride =
  (dbIdx !== -1 ? args[dbIdx + 1] : null) || process.env.XNAPIFY_DB || null;

// When override is active, route DB URL writes to .env.local
// so the user's .env is not permanently mutated.
if (dbOverride) useLocalEnv = true;

const flag = args.find(
  a => a.startsWith('--') && a !== '--db' && a !== dbOverride,
);

const COMMANDS = {
  '--start': async () => {
    const dialect = resolveDialect(dbOverride);
    if (dialect === 'sqlite') {
      console.log('💡 SQLite is in-process — no daemon needed');
      return;
    }
    if (dialect === 'postgres') {
      ensureDeps('postgres');
      ensureDeps('_embedded');
      return startPostgres(PG_DEFAULTS);
    }
    if (dialect === 'mysql') {
      ensureDeps('mysql');
      return startMysql(MYSQL_DEFAULTS);
    }
    console.warn(`⚠️  Unknown dialect: ${dialect}`);
  },
  '--stop': async () => {
    const dialect = resolveDialect(dbOverride);
    if (dialect === 'sqlite') {
      console.log('💡 SQLite is in-process — no daemon needed');
      return;
    }
    // Clean up .env.local override if present
    cleanupEnvLocal();
    if (dialect === 'postgres') return stopPostgres();
    if (dialect === 'mysql') return stopMysql();
    console.warn(`⚠️  Unknown dialect: ${dialect}`);
  },
  '--status': async () => {
    const dialect = resolveDialect(dbOverride);
    return showStatus(dialect);
  },
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
