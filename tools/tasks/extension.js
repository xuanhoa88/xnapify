/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { rspack } from '@rspack/core';
import pick from 'lodash/pick.js';
import semver from 'semver';

import config from '../config.js';
import {
  createExtensionConfig,
  getHmrWatchIgnored,
} from '../rspack/extension.config.js';
import {
  auditExtensionCapabilities,
  computeChecksum,
  generateExtensionId,
} from '../utils/extension.js';
import { copyDir, pathExists } from '../utils/fs.js';
import { logInfo, logError, formatDuration } from '../utils/logger.js';

const currentFilename = fileURLToPath(import.meta.url);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EXTENSION_PATH = config.env('XNAPIFY_EXTENSION_LOCAL_PATH', 'extensions');
const EXTENSIONS_DIR = path.resolve(config.APP_DIR, EXTENSION_PATH);
const EXTENSIONS_BUILD_DIR = path.resolve(config.BUILD_DIR, EXTENSION_PATH);

/** Fields preserved in the built package.json (allowlist for safety). */
const MANIFEST_FIELDS = [
  'name',
  'version',
  'description',
  'keywords',
  'author',
  'license',
  'homepage',
  'repository',
  'dependencies',
  'peerDependencies',
  'icon',
  'screenshots',
  'slots',
  'autoload',
  'xnapify',
];

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

/**
 * Discover valid extensions from the local extensions directory.
 * An extension must have a package.json with `name` and at least one
 * entry point (`main` or `browser`) that exists on disk.
 *
 * @returns {Array<{manifest: Object, name: string, dirName: string, version: string, path: string}>}
 */
function discoverExtensions() {
  if (!fs.existsSync(EXTENSIONS_DIR)) return [];

  return fs
    .readdirSync(EXTENSIONS_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => {
      const extensionPath = path.join(EXTENSIONS_DIR, dirent.name);
      try {
        const manifest = JSON.parse(
          fs.readFileSync(path.join(extensionPath, 'package.json'), 'utf8'),
        );

        if (!manifest.name) {
          logError(`Extension at ${dirent.name} missing "name" — skipped`);
          return null;
        }

        const hasMain =
          manifest.main &&
          fs.existsSync(path.join(extensionPath, manifest.main));
        const hasBrowser =
          manifest.browser &&
          fs.existsSync(path.join(extensionPath, manifest.browser));
        const hasNodered =
          manifest.nodered &&
          typeof manifest.nodered === 'object' &&
          manifest.nodered.nodes &&
          fs.existsSync(path.join(extensionPath, manifest.nodered.nodes));

        if (!hasMain && !hasBrowser && !hasNodered) return null;

        return {
          manifest,
          name: manifest.name,
          dirName: manifest.name,
          id: generateExtensionId(manifest.name),
          version: semver.clean(manifest.version) || '1.0.0',
          path: extensionPath,
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Manifest Generation
// ---------------------------------------------------------------------------

/**
 * (Re-)generate the built package.json for each extension.
 * Re-reads source manifest on every call so watch-mode picks up metadata changes.
 *
 * Reads `stats.json` (written by BuildManifestPlugin) to resolve
 * content-hashed filenames for entry points.
 *
 * The `id` field is generated at build time via `generateExtensionId(name)`
 * and written into the output manifest. Runtime managers read it directly.
 */
async function generateManifests(extensions) {
  for (const { name, dirName, version, path: extensionPath } of extensions) {
    const outputDir = path.join(EXTENSIONS_BUILD_DIR, dirName);
    fs.mkdirSync(outputDir, { recursive: true });

    // Re-read source manifest to pick up metadata changes during watch-mode
    let manifest;
    try {
      manifest = JSON.parse(
        fs.readFileSync(path.join(extensionPath, 'package.json'), 'utf8'),
      );
    } catch {
      logError(`Failed to read manifest for ${name} — skipped`);
      continue;
    }

    // Read stats.json for content-hashed filenames
    let buildManifest = {};
    try {
      buildManifest = JSON.parse(
        fs.readFileSync(path.join(outputDir, 'stats.json'), 'utf8'),
      );
    } catch {
      logInfo(
        `No stats.json for ${name} — entry points will use logical names`,
      );
    }

    const outputManifest = {
      ...pick(manifest, MANIFEST_FIELDS),
      // Canonical identity
      name,
      version,
      // Entry points (resolved from stats.json hashed filenames)
      ...(manifest.main && {
        main: `./${buildManifest['api.js'] || 'api.js'}`,
      }),
      ...(manifest.browser && {
        browser: `./${buildManifest['browser.js'] || 'browser.js'}`,
      }),
      ...(manifest.nodered && {
        nodered: manifest.nodered,
      }),
      // Build metadata
      id: generateExtensionId(name),
      builtAt: Date.now(),
    };

    // The checksum covers the built tree *and* this manifest, minus the two
    // fields that describe the build itself (`integrity`, `builtAt`). Hashing
    // the folder alone was unverifiable: the installer hashes what it received,
    // package.json included, and the file it received is the one written below.
    let checksum;
    try {
      checksum = await computeChecksum(outputDir, { manifest: outputManifest });
    } catch (checksumErr) {
      // Gracefully degrade — use a timestamp-based fallback so the build
      // continues even if hashing fails (e.g. broken symlinks).
      logError(
        `⚠️  Checksum failed for ${name}: ${checksumErr.message} — using fallback`,
      );
      checksum = `fallback-${Date.now()}`;
    }

    outputManifest.integrity = checksum;

    fs.writeFileSync(
      path.join(outputDir, 'package.json'),
      JSON.stringify(outputManifest, null, 2),
    );
  }
}

// ---------------------------------------------------------------------------
// Capability Audit
// ---------------------------------------------------------------------------

/**
 * Flag every container binding an extension resolves by name but never
 * declared under `xnapify.capabilities`.
 *
 * Extensions receive a capability-scoped container, so an undeclared binding
 * throws CapabilityDeniedError the first time that code path runs — often long
 * after the build. Surfacing it here turns a production crash into a warning
 * next to the compilation that produced it.
 *
 * @param {Array} extensions - Discovered extensions
 */
async function auditCapabilities(extensions) {
  for (const { name, manifest, path: extensionPath } of extensions) {
    let report;
    try {
      report = await auditExtensionCapabilities(extensionPath, manifest);
    } catch (err) {
      logError(`Capability audit failed for ${name}: ${err.message}`);
      continue;
    }

    for (const { capability, files } of report.undeclared) {
      logError(
        `⚠️  ${name} resolves "${capability}" but does not declare it in ` +
          `xnapify.capabilities (granted: ${report.granted.join(', ') || 'none'}) — ` +
          `used in ${files.join(', ')}`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Static Assets & Node-RED Nodes
// ---------------------------------------------------------------------------

function copyStaticAssets(extensions) {
  return extensions.map(
    async ({ name, dirName, manifest, path: extensionPath }) => {
      // 1. Copy public assets/
      const assetSource = path.join(extensionPath, 'assets');
      const assetTarget = path.join(EXTENSIONS_BUILD_DIR, dirName, 'assets');

      if (await pathExists(assetSource)) {
        await copyDir(assetSource, assetTarget);
        logInfo(`📁 Copied static assets for ${name}`);
      }

      // 2. Node-RED custom nodes are handled by rspack (extension.config.js)

      // 3. Copy Node-RED flow definitions from manifest.nodered.flows
      if (manifest.nodered && typeof manifest.nodered === 'object') {
        const flowsRel = manifest.nodered.flows;
        if (flowsRel) {
          const flowsSource = path.join(extensionPath, flowsRel);
          const flowsTarget = path.join(
            EXTENSIONS_BUILD_DIR,
            dirName,
            flowsRel,
          );

          if (await pathExists(flowsSource)) {
            await copyDir(flowsSource, flowsTarget);
            logInfo(`🔗 Copied Node-RED flows for ${name}`);
          }
        }
      }
    },
  );
}

// ---------------------------------------------------------------------------
// Extension Node Modules
// ---------------------------------------------------------------------------

/**
 * Symlink each extension's source `node_modules` into the build output.
 *
 * Rspack's `nodeExternals` marks extension-local dependencies as externals
 * (e.g. `passport-google-oauth20`). At runtime the built bundle `require()`s
 * them, but Node resolves from the *output* directory — which has no
 * `node_modules`. A symlink bridges the gap without duplicating files.
 */
function linkExtensionNodeModules(extensions) {
  return extensions.map(async ext => {
    const source = path.join(ext.path, 'node_modules');
    const target = path.join(EXTENSIONS_BUILD_DIR, ext.dirName, 'node_modules');

    if (!(await pathExists(source))) {
      console.log('⚡ node_modules not found for', ext.name);
      return;
    }

    // Remove stale link or directory before creating a fresh symlink
    try {
      const stat = await fs.promises.lstat(target);
      if (stat.isSymbolicLink() || stat.isDirectory()) {
        await fs.promises.rm(target, { recursive: true, force: true });
      }
    } catch {
      // target doesn't exist — nothing to remove
    }

    await fs.promises.symlink(source, target, 'junction');
    logInfo(`🔗 Linked node_modules for ${ext.name}`);
  });
}

// ---------------------------------------------------------------------------
// rspack Helpers
// ---------------------------------------------------------------------------

function handleBuildResult(err, stats, isWatch) {
  if (err) {
    logError('Rspack configuration error');
    console.error(err.stack || err);
    if (err.details) console.error(err.details);
    return err;
  }

  const info = stats.toJson();

  if (stats.hasErrors()) {
    logError('Rspack compilation errors');
    info.errors.forEach(e => console.error(e));
    return new Error('Rspack compilation errors');
  }

  if (stats.hasWarnings() && !isWatch) {
    console.warn('Rspack warnings:');
    info.warnings.forEach(w => console.warn(w));
  }

  return null;
}

let notifyTimer = null;

/** Notify the dev server that extension bundles have been rebuilt. */
function notifyServer(extensions) {
  if (notifyTimer) {
    clearTimeout(notifyTimer);
  }

  notifyTimer = setTimeout(() => {
    const names = extensions.map(p => p.name);
    const ids = extensions.map(p => p.id || generateExtensionId(p.name));
    const msg = { type: 'extensions-refreshed', extensions: names, ids };

    if (typeof process.send === 'function') {
      process.send(msg);
    } else {
      process.emit('message', msg);
    }
    logInfo(`🔌 Sent extensions-refreshed: ${names.join(', ')}`);
  }, 300);
}

// ---------------------------------------------------------------------------
// Watch-Mode (empty extensions directory)
// ---------------------------------------------------------------------------

/**
 * When no extensions exist yet, start a lightweight watcher that detects
 * when the first extension appears, then restarts with a real build.
 */
function watchForNewExtensions(options) {
  if (!fs.existsSync(EXTENSIONS_DIR)) {
    fs.mkdirSync(EXTENSIONS_DIR, { recursive: true });
  }

  const placeholderFile = path.join(EXTENSIONS_DIR, '.placeholder.js');
  if (!fs.existsSync(placeholderFile)) {
    fs.writeFileSync(placeholderFile, '// Placeholder for rspack watch\n');
  }

  const watchConfig = {
    mode: 'development',
    entry: placeholderFile,
    output: { path: EXTENSIONS_BUILD_DIR, filename: '.placeholder.js' },
    plugins: [
      {
        apply: compiler => {
          compiler.hooks.afterCompile.tap('WatchExtensionsDir', compilation => {
            compilation.contextDependencies.add(EXTENSIONS_DIR);
          });
          compiler.hooks.done.tap('CheckForExtensions', () => {
            if (discoverExtensions().length > 0) {
              logInfo('🔍 New extension(s) detected — restarting build');
              compiler.close(() => buildExtensions(options));
            }
          });
        },
      },
    ],
  };

  const watcher = rspack(watchConfig);
  return new Promise(resolve => {
    watcher.watch(
      { ignored: getHmrWatchIgnored(), aggregateTimeout: 300 },
      () => resolve(),
    );
  });
}

// ---------------------------------------------------------------------------
// Main Entry
// ---------------------------------------------------------------------------

async function buildExtensions(options = {}) {
  const isWatch =
    config.env('NODE_ENV') === 'development' &&
    (options.watch || process.argv.includes('--watch'));

  const extensions = discoverExtensions();

  if (extensions.length === 0) {
    logInfo('📦 No extensions found to build');
    if (isWatch) {
      logInfo('👀 Watching for new extensions...');
      return watchForNewExtensions(options);
    }
    return;
  }

  logInfo(`🔨 Compiling ${extensions.length} extension(s)...`);
  const start = Date.now();

  // Auto-cleanup: remove stale build directories that no longer match
  // any current extension (e.g. after ID scheme migration).
  // Handles both flat (my-ext/) and scoped (@org/name/) layouts.
  try {
    if (fs.existsSync(EXTENSIONS_BUILD_DIR)) {
      const validDirNames = new Set(extensions.map(e => e.dirName));
      const existing = fs.readdirSync(EXTENSIONS_BUILD_DIR, {
        withFileTypes: true,
      });
      for (const entry of existing) {
        if (!entry.isDirectory()) continue;

        if (entry.name.startsWith('@')) {
          // Scoped directory: check each child (@org/name)
          const scopeDir = path.join(EXTENSIONS_BUILD_DIR, entry.name);
          const scopeChildren = fs.readdirSync(scopeDir, {
            withFileTypes: true,
          });
          for (const child of scopeChildren) {
            if (!child.isDirectory()) continue;
            const scopedName = `${entry.name}/${child.name}`;
            if (!validDirNames.has(scopedName)) {
              const stale = path.join(scopeDir, child.name);
              fs.rmSync(stale, { recursive: true, force: true });
              logInfo(`🧹 Removed stale build directory: ${scopedName}`);
            }
          }
          // Remove empty scope directory
          const remaining = fs.readdirSync(scopeDir);
          if (remaining.length === 0) {
            fs.rmSync(scopeDir, { recursive: true, force: true });
          }
        } else if (!validDirNames.has(entry.name)) {
          const stale = path.join(EXTENSIONS_BUILD_DIR, entry.name);
          fs.rmSync(stale, { recursive: true, force: true });
          logInfo(`🧹 Removed stale build directory: ${entry.name}`);
        }
      }
    }
  } catch (cleanupErr) {
    logError(`Failed to clean stale build directories: ${cleanupErr.message}`);
  }

  const compiler = rspack(
    createExtensionConfig(extensions, EXTENSIONS_BUILD_DIR),
  );

  return new Promise((resolve, reject) => {
    let initialBuildComplete = false;

    const onBuild = async (err, stats) => {
      const error = handleBuildResult(err, stats, isWatch);

      if (error && !isWatch) {
        reject(error);
        return;
      }

      // Ensure output directories exist before attempting to write symlinks/assets.
      // This prevents ENOENT errors if Rspack compilation fails or hasn't emitted files yet.
      await Promise.all(
        extensions.map(async ext => {
          try {
            await fs.promises.mkdir(
              path.join(EXTENSIONS_BUILD_DIR, ext.dirName),
              { recursive: true },
            );
            console.log('⚡ Directory created for', ext.name);
          } catch (err) {
            console.error(`Error creating directory for ${ext.name}:`, err);
          }
        }),
      );

      // Link node_modules and copy assets first so the output directory
      // is complete before generateManifests checksums it.
      await Promise.all([
        ...copyStaticAssets(extensions),
        ...linkExtensionNodeModules(extensions),
      ]);
      await generateManifests(extensions);
      await auditCapabilities(extensions);

      logInfo(
        `✅ Extension build completed in ${formatDuration(Date.now() - start)}`,
      );

      if (!error && isWatch) {
        notifyServer(extensions);
      }

      if (!isWatch) {
        compiler.close(closeErr => {
          if (closeErr) console.error('Failed to close compiler:', closeErr);
          resolve();
        });
      } else if (!initialBuildComplete) {
        initialBuildComplete = true;
        resolve();
      }
    };

    if (isWatch) {
      logInfo('👀 Watching for extension changes...');
      compiler.watch(
        { ignored: getHmrWatchIgnored(), aggregateTimeout: 300 },
        onBuild,
      );
    } else {
      compiler.run(onBuild);
    }
  });
}

// CLI entry point
if (
  process.argv[1] === currentFilename ||
  process.argv[1] === currentFilename.replace(/\.js$/, '')
) {
  buildExtensions().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

export default buildExtensions;
