/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

const { spawn } = require('child_process');
const { existsSync } = require('fs');
const { resolve } = require('path');
const { BuildError } = require('./utils/error');
const {
  formatDuration,
  isSilent,
  isVerbose,
  logDebug,
  logError,
  logInfo,
} = require('./utils/logger');

// Cache verbose and silent checks
const verbose = isVerbose();
const silent = isSilent();

/**
 * Auto-detect NODE_ENV based on command-line arguments
 * Used for tasks that should change behavior based on flags
 */
function detectNodeEnv(taskConfig) {
  const taskArgs = process.argv.slice(3).map(arg => arg.toLowerCase());

  // Plugin task rules
  if (taskConfig.name === 'plugin') {
    if (
      taskArgs.includes('--watch') ||
      taskArgs.includes('--dev') ||
      taskArgs.includes('--development')
    ) {
      logDebug(
        'Auto-detected NODE_ENV=development from --watch flag in plugin task',
      );
      return 'development';
    }

    logDebug('Auto-detected NODE_ENV=production from plugin task');
    return 'production';
  }

  // Generic rules for all tasks
  if (taskArgs.includes('--production') || taskArgs.includes('--prod')) {
    logDebug('Auto-detected NODE_ENV=production from flags');
    return 'production';
  }
  if (taskArgs.includes('--dev') || taskArgs.includes('--development')) {
    logDebug('Auto-detected NODE_ENV=development from flags');
    return 'development';
  }
  return null;
}

/**
 * Simple task runner - executes a task function and handles errors
 * This is used when importing tasks directly (not via CLI)
 */
function main(fn, options) {
  const task = typeof fn.default === 'undefined' ? fn : fn.default;
  const taskName = task.name || 'anonymous';
  const startTime = Date.now();

  // Log task start
  if (!silent) {
    logInfo(`🏁 Starting '${taskName}'...`);
  }

  logDebug(`Executing task: ${taskName}`);
  if (options) {
    logDebug(`Options: ${JSON.stringify(options)}`);
  }

  return Promise.resolve()
    .then(() => task(options))
    .then(result => {
      const duration = Date.now() - startTime;

      // Log completion
      if (!silent) {
        const emoji = duration > 10000 ? '🐌' : duration > 5000 ? '⚠️' : '✅';
        logInfo(
          `${emoji} Finished '${taskName}' after ${formatDuration(duration)}`,
        );
      }

      return result;
    })
    .catch(error => {
      const formattedDuration = formatDuration(Date.now() - startTime);

      // Wrap error if needed
      const taskError =
        error instanceof BuildError
          ? error
          : new BuildError(`Task '${taskName}' failed: ${error.message}`, {
              task: taskName,
              duration: formattedDuration,
              originalError: error.message,
              stack: error.stack,
            });

      // Log failure
      if (!silent) {
        let errorMessage = `❌ Failed '${taskName}' after ${formattedDuration}\n${taskError.message}`;

        if (verbose && taskError.stack) {
          errorMessage += `\n\nStack trace:\n${taskError.stack}`;
        }

        logError(errorMessage);
      }

      throw taskError;
    });
}

// Available tasks configuration
const AVAILABLE_TASKS = [
  {
    name: 'build',
    description: 'Build the project for production',
    processEnv: { NODE_ENV: 'production' },
  },
  {
    name: 'dev',
    description: 'Start the project for development',
    processEnv: { NODE_ENV: 'development' },
  },
  {
    name: 'test',
    description: 'Run tests with Jest',
    processEnv: { NODE_ENV: 'test' },
  },
  {
    name: 'benchmark',
    description: 'Run performance benchmarks (*.benchmark.js)',
    processEnv: { NODE_ENV: 'test' },
  },
  {
    name: 'plugin',
    description: 'Build plugins (use --watch for development)',
  },
  {
    name: 'clean',
    description: 'Clean build directory',
  },
  {
    name: 'prettier',
    description: 'Format code with Prettier',
  },
  {
    name: 'stylelint',
    description: 'Lint CSS files with Stylelint',
  },
  {
    name: 'benchmark',
    description: 'Run performance benchmarks (*.benchmark.js)',
    processEnv: { NODE_ENV: 'test' },
  },
];

/**
 * Show help message with available tasks
 */
function showHelp() {
  logInfo('\n📋 Available tasks:\n');
  AVAILABLE_TASKS.forEach(({ name, description }) => {
    logInfo(`   ${name.padEnd(12)} ${description}`);
  });
  logInfo('\n💡 Usage: node tools/run <task> [options]');
  logInfo('   Options:');
  logInfo('     --verbose     Show detailed output');
  logInfo('     --silent      Suppress all output');
  logInfo('');
}

/**
 * Validate that a task exists and its file is present
 */
function validateTask(taskName) {
  // Check if task is in available tasks list
  const taskConfig = AVAILABLE_TASKS.find(task => task.name === taskName);
  if (!taskConfig) {
    throw new BuildError(`Unknown task '${taskName}'`, {
      task: taskName,
      availableTasks: AVAILABLE_TASKS.map(t => t.name),
    });
  }

  // Check if task file exists
  const taskPath = resolve(__dirname, 'tasks', `${taskName}.js`);
  if (!existsSync(taskPath)) {
    throw new BuildError(`Task file not found: ${taskPath}`, {
      task: taskName,
      taskPath,
    });
  }

  return { taskConfig, taskPath };
}

/**
 * Execute a task in a child process.
 * Each task runs in isolation with its own NODE_ENV.
 */
function executeTask(taskName) {
  const { taskConfig, taskPath } = validateTask(taskName);

  // Resolve NODE_ENV: explicit env > task config > CLI flags > fallback
  const nodeEnv =
    process.env.NODE_ENV ||
    (taskConfig.processEnv && taskConfig.processEnv.NODE_ENV) ||
    detectNodeEnv(taskConfig) ||
    'development';

  // Set NODE_ENV before dotenv-flow so it loads the correct .env.{NODE_ENV} file
  process.env.NODE_ENV = nodeEnv;

  // Load environment-specific .env files (.env, .env.local, .env.{NODE_ENV}, etc.)
  require('dotenv-flow').config({ silent: true, default_node_env: nodeEnv });

  // Build child process environment
  // Priority: taskConfig.processEnv > dotenv-flow-enhanced process.env
  const taskEnv = { ...process.env, ...taskConfig.processEnv };

  logDebug(`Executing task: ${taskName} (NODE_ENV=${taskEnv.NODE_ENV})`);

  const taskArgs = [taskPath, ...process.argv.slice(3)];
  logDebug(`Spawning: node ${taskArgs.join(' ')}`);

  return new Promise((resolve, reject) => {
    const taskProcess = spawn('node', [...process.execArgv, ...taskArgs], {
      stdio: 'inherit',
      env: taskEnv,
      cwd: require('./config').CWD,
    });

    // Use `once` to prevent double-firing edge cases
    taskProcess.once('exit', (code, signal) => {
      if (signal) {
        reject(
          new BuildError(`Task '${taskName}' killed by signal ${signal}`, {
            task: taskName,
            signal,
          }),
        );
      } else if (code !== 0) {
        reject(
          new BuildError(`Task '${taskName}' exited with code ${code}`, {
            task: taskName,
            exitCode: code,
          }),
        );
      } else {
        logDebug(`Task '${taskName}' completed successfully`);
        resolve();
      }
    });

    taskProcess.once('error', error => {
      reject(
        new BuildError(`Failed to spawn task '${taskName}'`, {
          task: taskName,
          originalError: error.message,
          stack: error.stack,
        }),
      );
    });
  });
}

/**
 * Handle CLI errors with appropriate messaging
 */
function handleCLIError(error) {
  let errorMessage = `\n🚫 ${error.message}`;

  // Show stack trace in verbose mode
  if (verbose && error.stack) {
    errorMessage += `\n\nStack trace:\n${error.stack}`;
  }

  // Show additional context if available
  if (error.context) {
    logDebug(`Error context: ${JSON.stringify(error.context, null, 2)}`);

    // Show available tasks if unknown task error
    if (error.context.availableTasks) {
      showHelp();
    }
  }

  logError(errorMessage);
  process.exit(1);
}

// CLI handling
if (require.main === module) {
  const taskName = process.argv[2];

  // No task provided
  if (!taskName) {
    logError('\n🚫 Error: No task specified');
    showHelp();
    process.exit(1);
  }

  // Handle help command
  if (taskName === 'help' || taskName === '--help' || taskName === '-h') {
    showHelp();
    process.exit(0);
  }

  // Execute task in child process
  executeTask(taskName).catch(handleCLIError);
}

module.exports = main;
