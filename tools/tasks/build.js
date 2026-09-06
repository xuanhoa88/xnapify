/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { execFile } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

import { rspack } from '@rspack/core';

import config from '../config.js';
import {
  clientConfig as rspackClientConfig,
  serverConfig as rspackServerConfig,
  workerConfig as rspackWorkerConfig,
} from '../rspack/app.config.js';
import { createRspackConfig } from '../rspack/base.config.js';
import {
  BuildError,
  logDetailedError,
  setupGracefulShutdown,
} from '../utils/error.js';
import {
  copyDir,
  copyFile,
  pathExists,
  readDir,
  readFile,
  writeFile,
} from '../utils/fs.js';
import { generateJWT } from '../utils/jwt.js';
import {
  formatBytes,
  formatDuration,
  isSilent,
  isVerbose,
  logDebug,
  logInfo,
  logWarn,
} from '../utils/logger.js';
import { withBuildRetry } from '../utils/retry.js';

import clean from './clean.js';
import createBundledExtensions from './extension.js';

const currentFilename = fileURLToPath(import.meta.url);

const execFileAsync = promisify(execFile);

// Build configuration
const BUILD_TIMESTAMP = Date.now();

// Cache verbose check for use throughout the build
const verbose = isVerbose();

/**
 * Copy static files to build directory
 * Simple copy since it always runs after clean in the build pipeline
 */
async function copyFiles() {
  logInfo(`📁 Copying static files...`);

  try {
    // 1. Copy LICENSE.txt if it exists
    const licensePath = path.join(config.CWD, 'LICENSE.txt');
    if (await pathExists(licensePath)) {
      await copyFile(licensePath, path.join(config.BUILD_DIR, 'LICENSE.txt'));
      logDebug('Copied LICENSE.txt');
    }

    // 2. Copy public directory if it exists
    if (await pathExists(config.PUBLIC_DIR)) {
      await copyDir(config.PUBLIC_DIR, path.join(config.BUILD_DIR, 'public'));
      logDebug('Copied public directory');
    }

    // 3. Generate JWT and copy .env to build directory
    await generateJWT(config.CWD, config.BUILD_DIR);

    // 4. Copy .npmrc if it exists
    const npmrcPath = path.join(config.CWD, '.npmrc');
    const normalizedNpmrcContent = [
      '# Force production mode — npm run setup installs only production deps',
      'production=true',
    ];
    if (await pathExists(npmrcPath)) {
      const npmrcContent = await readFile(npmrcPath, 'utf-8');
      normalizedNpmrcContent.unshift(
        npmrcContent.replace(/^production\s*=\s*.+$/m, '').trimEnd(),
      );
    }
    await writeFile(
      path.join(config.BUILD_DIR, '.npmrc'),
      normalizedNpmrcContent.join('\n'),
    );
    logDebug('Copied .npmrc');

    // 5. Copy .env.xnapify template (preboot creates .env from it)
    const envTemplatePath = path.join(config.CWD, '.env.xnapify');
    if (await pathExists(envTemplatePath)) {
      await copyFile(
        envTemplatePath,
        path.join(config.BUILD_DIR, '.env.xnapify'),
      );
      logDebug('Copied .env.xnapify');
    }

    logInfo('✅ Static files copied');

    // 6. Generate package.json
    const manifest = await readFile(
      path.join(config.CWD, 'package.json'),
      'utf-8',
    );
    const pkg = JSON.parse(manifest);

    // Remove DB drivers — installed on-demand by preboot.js
    const buildDeps = { ...pkg.dependencies };
    delete buildDeps.sqlite3;

    await writeFile(
      path.join(config.BUILD_DIR, 'package.json'),
      JSON.stringify(
        {
          private: true,
          type: 'commonjs',
          name: pkg.name || `xnapify-${BUILD_TIMESTAMP}`,
          version: pkg.version || `0.0.1-${BUILD_TIMESTAMP}`,
          engines: pkg.engines,
          dependencies: buildDeps,
          scripts: {
            preinstall: 'node npm/preinstall.js',
            setup: 'node npm/setup.js',
            prestart: 'node npm/preboot.js',
            start: 'node server.js',
          },
        },
        null,
        2,
      ),
    );
    logDebug('Generated package.json');
  } catch (error) {
    throw new BuildError(`Copy failed: ${error.message}`, {
      originalError: error.message,
    });
  }
}

/**
 * Verify a generated lockfile actually describes the manifest beside it.
 *
 * `npm ci` refuses to install when the lockfile's root entry disagrees with
 * package.json, and `tools/npm/setup.js` only reaches for `npm ci` when a
 * lockfile is present — so a lockfile that does not match is worse than none:
 * the production install would fail outright instead of quietly degrading.
 *
 * @param {Object} pkg - Parsed build/package.json
 * @param {Object} lock - Parsed build/package-lock.json
 * @throws {BuildError} When the lockfile does not describe the manifest
 */
export function assertLockfileMatchesManifest(pkg, lock) {
  const root = lock?.packages?.[''];
  if (!root) {
    throw new BuildError('Lockfile has no root package entry');
  }

  const wanted = Object.keys(pkg?.dependencies || {});
  const locked = Object.keys(root.dependencies || {});

  const missing = wanted.filter(name => !locked.includes(name));
  const unexpected = locked.filter(name => !wanted.includes(name));
  if (missing.length > 0 || unexpected.length > 0) {
    throw new BuildError(
      `Lockfile does not match package.json (missing: ${
        missing.join(', ') || 'none'
      }; unexpected: ${unexpected.join(', ') || 'none'})`,
      { missing, unexpected },
    );
  }

  const devDependencies = Object.keys(root.devDependencies || {});
  if (devDependencies.length > 0) {
    throw new BuildError(
      `Lockfile still carries devDependencies: ${devDependencies.join(', ')}`,
      { devDependencies },
    );
  }
}

/**
 * Generate a lockfile for the build directory.
 *
 * The shipped image installs from `build/`, whose dependency set is a pruned
 * subset of the repo's (no devDependencies, no sqlite3). The root
 * package-lock.json cannot simply be copied in — `npm ci` hard-fails when the
 * lock disagrees with the manifest beside it — so it is copied in as a *seed*
 * and npm is asked to rewrite it against build/package.json. Seeding keeps
 * every surviving version identical to the one the repo resolved; without it
 * npm re-resolves against the registry and two builds of the same commit can
 * pin different patch releases.
 *
 * Without this step `tools/npm/setup.js` finds no lockfile in the build
 * directory and falls back to `npm install`, leaving the image unpinned.
 */
async function generateLockfile() {
  logInfo('🔒 Generating lockfile...');

  const rootLock = path.join(config.CWD, 'package-lock.json');
  const buildLock = path.join(config.BUILD_DIR, 'package-lock.json');

  if (await pathExists(rootLock)) {
    await copyFile(rootLock, buildLock);
    logDebug('Seeded package-lock.json from the repo lockfile');
  } else {
    logWarn(
      'No root package-lock.json to seed from — versions resolve fresh from the registry',
    );
  }

  const env = {
    ...process.env,
    CI: 'true',
    npm_config_engine_strict: 'false',
  };
  delete env.NODE_OPTIONS;

  try {
    await execFileAsync(
      process.platform === 'win32' ? 'npm.cmd' : 'npm',
      [
        'install',
        '--package-lock-only',
        '--omit=dev',
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
      ],
      { cwd: config.BUILD_DIR, env, maxBuffer: 32 * 1024 * 1024 },
    );
  } catch (error) {
    throw new BuildError(`Lockfile generation failed: ${error.message}`, {
      originalError: error.message,
    });
  }

  const [manifest, lock] = await Promise.all([
    readFile(path.join(config.BUILD_DIR, 'package.json'), 'utf-8'),
    readFile(buildLock, 'utf-8'),
  ]);
  assertLockfileMatchesManifest(JSON.parse(manifest), JSON.parse(lock));

  logInfo('✅ Lockfile generated');
}

/**
 * Bundle tools/npm scripts into standalone files in the build directory.
 * Reuses the shared server rspack config for consistency (node target,
 * externals, resolve, etc.) with lightweight overrides for npm scripts.
 */
async function buildNpmScripts() {
  logInfo('📦 Building npm scripts...');

  // Auto-discover all .js files in tools/npm/
  const npmDir = path.join(config.CWD, 'tools/npm');
  const files = await readDir(npmDir);
  const entry = Object.fromEntries(
    files
      .filter(f => f.endsWith('.js'))
      .map(f => [path.basename(f, '.js'), path.join(npmDir, f)]),
  );

  const npmConfig = createRspackConfig('server', {
    entry,
    output: {
      path: path.join(config.BUILD_DIR, 'npm'),
      filename: '[name].js',
    },
    // npm scripts are plain CJS — no loaders, no transforms.
    module: {
      rules: [],
      parser: {
        javascript: {
          // npm scripts use require.resolve(dep.name) at runtime to probe
          // optional dependencies. Disable static analysis — all non-relative
          // imports are externalized and resolved at runtime by Node.
          requireResolve: false,
          // Prevent "Critical dependency: the request of a dependency is an
          // expression" diagnostics for intentional dynamic require() calls
          // (e.g. require('embedded-postgres') inside conditional blocks).
          exprContextCritical: false,
        },
      },
    },
    optimization: {
      minimize: true,
      minimizer: [
        new rspack.SwcJsMinimizerRspackPlugin({
          compress: { drop_console: false },
        }),
      ],
    },
    devtool: false,
    // Externalize ALL non-relative imports. npm scripts run after
    // `npm install` in production — deps (including on-demand ones like
    // embedded-postgres, dialect drivers, dotenv-flow) must resolve at
    // runtime, not be bundled at build time.
    externals: [
      ({ request }, callback) => {
        if (/^\.{0,2}[/\\]/.test(request)) return callback();
        callback(null, `commonjs ${request}`);
      },
    ],
  });

  const compiler = rspack(npmConfig);

  return new Promise((resolve, reject) => {
    compiler.run((err, stats) => {
      compiler.close(() => {});

      if (err) {
        reject(err);
        return;
      }

      if (stats.hasErrors()) {
        const info = stats.toJson({ errors: true });
        reject(new Error(info.errors.map(e => e.message).join('\n')));
        return;
      }

      if (stats.hasWarnings()) {
        const info = stats.toJson({ warnings: true });
        info.warnings.forEach(w => logWarn(w.message || w));
      }

      logInfo('✅ npm scripts bundled');
      resolve();
    });
  });
}

/**
 * Analyze rspack compilation stats
 * Uses rspack's built-in stats.toJson() for comprehensive data
 */
function analyzeStats(stats) {
  // Get rspack's JSON stats (includes all compilations)
  const jsonStats = stats.toJson({
    all: false,
    assets: true,
    errors: true,
    warnings: true,
    timings: true,
  });

  // Collect all assets (exclude source maps)
  const allAssets = [];

  // Handle multi-compiler stats (client + server + workers)
  const children = jsonStats.children || [jsonStats];

  // Collect ALL assets for summary (exclude source maps)
  children.forEach(childStats => {
    (childStats.assets || []).forEach(asset => {
      const name = typeof asset.name === 'string' ? asset.name : null;
      if (name && !name.endsWith('.map')) {
        allAssets.push({
          name: asset.name,
          size: asset.size,
        });
      }
    });
  });

  // Client-only assets for size warnings — server bundles load from disk,
  // their size doesn't affect page load performance.
  const clientAssets = (children[0]?.assets || [])
    .filter(asset => {
      const name = typeof asset.name === 'string' ? asset.name : null;
      return name && !name.endsWith('.map');
    })
    .map(asset => ({ name: asset.name, size: asset.size }));

  // Sort by size and calculate totals
  allAssets.sort((a, b) => b.size - a.size);
  const totalSize = allAssets.reduce((sum, asset) => sum + asset.size, 0);

  return {
    totalSize,
    assetCount: allAssets.length,
    warnings: (jsonStats.warnings || []).length,
    errors: (jsonStats.errors || []).length,
    oversizedAssets: clientAssets.filter(
      asset => asset.size > config.bundleMaxAssetSize,
    ),
    largestAssets: allAssets.slice(0, 5),
    rspackStats: jsonStats, // Include full rspack stats for report
  };
}

/**
 * Log bundle results
 */
function logBundleResults(analysis, duration) {
  const formattedDuration = formatDuration(duration);
  logInfo(`✅ Bundle complete in ${formattedDuration}`);

  const bundleSummary = [
    `\n📊 Bundle summary:`,
    `   Total size: ${formatBytes(analysis.totalSize)}`,
    `   Assets: ${analysis.assetCount}`,
    `   Duration: ${formattedDuration}`,
  ];

  if (analysis.largestAssets.length > 0) {
    bundleSummary.push(`   Largest assets:`);
    analysis.largestAssets.forEach(asset => {
      bundleSummary.push(`      • ${asset.name}: ${formatBytes(asset.size)}`);
    });
  }

  if (verbose) {
    logInfo(bundleSummary.join('\n'));
  }

  // Warnings
  if (analysis.oversizedAssets.length > 0) {
    const warningMessage = [
      `⚠️ ${
        analysis.oversizedAssets.length
      } asset(s) exceed size limit (${formatBytes(config.bundleMaxAssetSize)})`,
    ];

    if (verbose) {
      analysis.oversizedAssets.slice(0, 3).forEach(asset => {
        warningMessage.push(
          `      • ${asset.name}: ${formatBytes(asset.size)}`,
        );
      });
    }

    logWarn(warningMessage.join('\n'));
  }

  if (duration > 30000) {
    logWarn(`⚠️ Slow build detected (${formattedDuration})`);
  }
}

/**
 * Create rspack bundle
 * Simplified to focus on core bundling logic
 */
function createBundledApp() {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    logInfo(`🔨 Compiling application bundles...`);

    const compiler = rspack([
      rspackClientConfig,
      rspackServerConfig,
      ...rspackWorkerConfig,
    ]);

    compiler.run(async (err, stats) => {
      const duration = Date.now() - startTime;

      // Handle errors
      if (err) {
        compiler.close(() => {
          reject(
            new BuildError(`Rspack compilation failed: ${err.message}`, {
              originalError: err.message,
              stack: err.stack,
            }),
          );
        });
        return;
      }

      if (stats.hasErrors()) {
        const info = stats.toJson('errors-only');
        compiler.close(() => {
          reject(
            new BuildError('Rspack compilation errors', {
              errors: info.errors.map(e => e.message || e),
              stats: stats.toString('errors-only'),
            }),
          );
        });
        return;
      }

      // Analyze and report
      const analysis = analyzeStats(stats);
      logBundleResults(analysis, duration);

      // Close and resolve
      compiler.close(closeErr => {
        if (closeErr) {
          logWarn(`Compiler close error: ${closeErr.message}`);
        }
        resolve({ stats, analysis, duration });
      });
    });
  });
}

/**
 * Execute a build step with timing and error handling
 */
async function executeStep(step, index, total, silent) {
  const start = Date.now();

  if (!silent) {
    logInfo(`[${index + 1}/${total}] ${step.description}...`);
  }

  try {
    // Execute the step's task function
    await step.task();

    const duration = Date.now() - start;

    if (verbose) {
      logInfo(`   ${step.name} completed (${formatDuration(duration)})`);
    }
  } catch (error) {
    const duration = Date.now() - start;
    throw new BuildError(`Step '${step.name}' failed: ${error.message}`, {
      step: step.name,
      duration,
      originalError: error,
    });
  }
}

/**
 * Compiles the project from source files into a distributable
 * format and copies it to the output (build) folder.
 */
async function main() {
  const startTime = Date.now();
  const silent = isSilent(); // Cache silent check

  if (!silent) {
    logInfo('🏗️  Starting production build...');
  }

  try {
    // Setup graceful shutdown
    setupGracefulShutdown(() => {
      logInfo(`🛑 Build operation interrupted`);
    });

    // Define build steps with uniform task functions
    const buildSteps = [
      {
        name: 'clean',
        task: () =>
          withBuildRetry(() => clean(), {
            operation: 'clean',
            verbose,
          }),
        description: 'Cleaning build directory',
      },
      {
        name: 'copy',
        task: () =>
          withBuildRetry(() => copyFiles(), {
            operation: 'copy-files',
            verbose,
          }),
        description: 'Copying static files',
      },
      {
        name: 'lockfile',
        task: () =>
          withBuildRetry(() => generateLockfile(), {
            operation: 'generate-lockfile',
            verbose,
          }),
        description: 'Generating lockfile',
      },
      {
        name: 'npm scripts',
        task: () =>
          withBuildRetry(() => buildNpmScripts(), {
            operation: 'build-npm-scripts',
            verbose,
          }),
        description: 'Building npm scripts',
      },
      {
        name: 'apps',
        task: () =>
          withBuildRetry(
            () =>
              Promise.all([
                createBundledExtensions({ watch: false }),
                createBundledApp(),
              ]),
            {
              operation: 'build-apps',
              verbose,
            },
          ),
        description: 'Building apps',
      },
    ];

    if (verbose) {
      logInfo(`📋 Build pipeline: ${buildSteps.length} steps`);
    }

    // Execute build steps sequentially
    for (const [index, step] of buildSteps.entries()) {
      await executeStep(step, index, buildSteps.length, silent);
    }

    // Success
    const duration = Date.now() - startTime;
    logInfo(`✅ Build completed in ${formatDuration(duration)}`);

    // Show deployment instructions
    if (!silent) {
      const deploymentInstructions = [
        '',
        '📋 Next steps:',
        '',
        '  1️⃣ Install production dependencies (REQUIRED):',
        `     cd '${config.BUILD_DIR}' && npm run setup`,
        '',
        '  2️⃣ Test locally:',
        `     cd '${config.BUILD_DIR}'`,
        '     npm start',
        '',
        '  3️⃣ Deploy:',
        '     • Docker: See Dockerfile in project root',
        `     • Server: Deploy '${config.BUILD_DIR}' directory with node_modules/`,
        '',
        `⚠️ Important: Run server from '${config.BUILD_DIR}' directory`,
        '   See docs/deployment.md for complete deployment guide',
        '',
      ].join('\n');

      logInfo(deploymentInstructions);
    }

    if (verbose) {
      const buildSummary = [
        '📦 Build Summary:',
        `   📁 Output: '${config.BUILD_DIR}'`,
        `   📊 Steps: ${buildSteps.length}`,
        '   📄 Files:',
        `      • '${config.BUILD_DIR}/server.js' (server bundle)`,
        `      • '${config.BUILD_DIR}/vendors.js' (server vendors)`,
        `      • '${config.BUILD_DIR}/public/assets/' (client assets)`,
        `      • '${config.BUILD_DIR}/package.json' (dependencies list)`,
      ].join('\n');
      logInfo(buildSummary);
    }
  } catch (error) {
    const duration = Date.now() - startTime;

    const buildError =
      error instanceof BuildError
        ? error
        : new BuildError(`Build failed: ${error.message}`, {
            duration,
            originalError: error,
          });

    logDetailedError(buildError, { operation: 'build' });

    if (!silent) {
      const troubleshootingTips = [
        '',
        '💡 Troubleshooting tips:',
        '   1. Try: npm run clean && npm run build',
        '   2. Check for syntax errors in your code',
        '   3. Ensure dependencies are installed: npm run setup',
        '   4. Run with LOG_LEVEL=verbose for details',
        '   5. See DEPLOYMENT.md for deployment issues',
        '',
      ].join('\n');

      logWarn(troubleshootingTips);
    }

    throw buildError;
  }
}

// Execute if called directly (as child process)
if (
  process.argv[1] === currentFilename ||
  process.argv[1] === currentFilename.replace(/\.js$/, '')
) {
  main().catch(error => {
    console.error(error);
    process.exit(1);
  });
}

export default main;
