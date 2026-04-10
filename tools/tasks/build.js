/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

const fsP = require('fs/promises');
const path = require('path');

const TerserPlugin = require('terser-webpack-plugin');
const webpack = require('webpack');

const config = require('../config');
const {
  BuildError,
  logDetailedError,
  setupGracefulShutdown,
} = require('../utils/error');
const {
  copyDir,
  copyFile,
  pathExists,
  readFile,
  writeFile,
} = require('../utils/fs');
const { generateJWT } = require('../utils/jwt');
const {
  formatBytes,
  formatDuration,
  isSilent,
  isVerbose,
  logDebug,
  logInfo,
  logWarn,
} = require('../utils/logger');
const { withBuildRetry } = require('../utils/retry');
const {
  clientConfig: webpackClientConfig,
  serverConfig: webpackServerConfig,
  workerConfig: webpackWorkerConfig,
} = require('../webpack/app.config');
const { createWebpackConfig } = require('../webpack/base.config');

const clean = require('./clean');
const buildExtensions = require('./extension');

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
 * Bundle tools/npm scripts into standalone files in the build directory.
 * Reuses the shared server webpack config for consistency (node target,
 * externals, resolve, etc.) with lightweight overrides for npm scripts.
 */
async function buildNpmScripts() {
  logInfo('📦 Building npm scripts...');

  // Auto-discover all .js files in tools/npm/
  const npmDir = path.join(config.CWD, 'tools/npm');
  const files = await fsP.readdir(npmDir);
  const entry = Object.fromEntries(
    files
      .filter(f => f.endsWith('.js'))
      .map(f => [path.basename(f, '.js'), path.join(npmDir, f)]),
  );

  const npmConfig = createWebpackConfig('server', {
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
        new TerserPlugin({
          terserOptions: {
            compress: { drop_console: false, passes: 2 },
            mangle: { toplevel: false },
            output: { comments: false },
          },
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

  const compiler = webpack(npmConfig);

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
 * Analyze webpack compilation stats
 * Uses webpack's built-in stats.toJson() for comprehensive data
 */
function analyzeStats(stats) {
  // Get webpack's JSON stats (includes all compilations)
  const jsonStats = stats.toJson({
    all: false,
    assets: true,
    errors: true,
    warnings: true,
    timings: true,
  });

  // Collect all assets (exclude source maps)
  const allAssets = [];

  // Handle multi-compiler stats (client + server)
  const children = jsonStats.children || [jsonStats];

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

  // Sort by size and calculate totals
  allAssets.sort((a, b) => b.size - a.size);
  const totalSize = allAssets.reduce((sum, asset) => sum + asset.size, 0);

  return {
    totalSize,
    assetCount: allAssets.length,
    warnings: (jsonStats.warnings || []).length,
    errors: (jsonStats.errors || []).length,
    oversizedAssets: allAssets.filter(
      asset => asset.size > config.bundleMaxAssetSize,
    ),
    largestAssets: allAssets.slice(0, 5),
    webpackStats: jsonStats, // Include full webpack stats for report
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
 * Create webpack bundle
 * Simplified to focus on core bundling logic
 */
function createBundle() {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    logInfo(`🔨 Compiling webpack bundles...`);

    const compiler = webpack([
      webpackClientConfig,
      webpackServerConfig,
      ...webpackWorkerConfig,
    ]);

    compiler.run(async (err, stats) => {
      const duration = Date.now() - startTime;

      // Handle errors
      if (err) {
        compiler.close(() => {
          reject(
            new BuildError(`Webpack compilation failed: ${err.message}`, {
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
            new BuildError('Webpack compilation errors', {
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
        name: 'npm scripts',
        task: () =>
          withBuildRetry(() => buildNpmScripts(), {
            operation: 'build-npm-scripts',
            verbose,
          }),
        description: 'Building npm scripts',
      },
      {
        name: 'extensions',
        task: () =>
          withBuildRetry(() => buildExtensions(), {
            operation: 'build-extensions',
            verbose,
          }),
        description: 'Building extensions',
      },
      {
        name: 'apps',
        task: () =>
          withBuildRetry(() => createBundle(), {
            operation: 'build-apps',
            verbose,
          }),
        description: 'Building apps',
      },
    ];

    if (verbose) {
      logInfo(`📋 Build pipeline: ${buildSteps.length} steps`);
    }

    // Execute build steps sequentially
    for (const [index, step] of buildSteps.entries()) {
      // eslint-disable-next-line no-await-in-loop
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
if (require.main === module) {
  main().catch(error => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = main;
