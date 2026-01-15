/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

const { spawn } = require('child_process');
const path = require('path');
const config = require('./config');
const { BuildError } = require('./utils/error');
const {
  formatDuration,
  isSilent,
  isVerbose,
  logDebug,
  logError,
  logInfo,
} = require('./utils/logger');

/**
 * Simple task runner - executes a task function and handles errors
 */
function main(fn, options) {
  const task = typeof fn.default === 'undefined' ? fn : fn.default;
  const taskName = task.name || 'anonymous';
  const startTime = Date.now();
  const silent = isSilent(); // Cache silent check

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
        const verbose = isVerbose();
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
    name: 'clean',
    description: 'Clean build directory',
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
    name: 'prettier',
    description: 'Format code with Prettier',
  },
  {
    name: 'stylelint',
    description: 'Lint CSS files with Stylelint',
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
 * Execute a task in a child process
 * Each task runs in isolation with its own NODE_ENV
 */
function executeTask(taskName) {
  return new Promise((resolve, reject) => {
    logDebug(`Spawning task: ${taskName}`);

    // Get task-specific environment variables (if any)
    const taskConfig = AVAILABLE_TASKS.find(task => task.name === taskName);
    const taskEnv = taskConfig && taskConfig.processEnv;

    // Merge task-specific environment variables with process.env
    const processEnv = taskEnv
      ? Object.assign({}, process.env, taskEnv)
      : process.env;
    processEnv.NODE_ENV = processEnv.NODE_ENV || 'development';

    // Get additional arguments to forward to task (everything after task name)
    const taskArgs = process.argv.slice(3); // Skip node, script, and task name

    // Add task path to arguments
    taskArgs.unshift(path.resolve(__dirname, 'tasks', `${taskName}.js`));

    // Spawn task in child process using node
    const taskProcess = spawn('node', taskArgs, {
      stdio: 'inherit', // Inherit stdin, stdout, stderr
      env: processEnv,
      cwd: config.CWD,
    });

    // Handle task process exit
    taskProcess.on('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`Task '${taskName}' killed by signal ${signal}`));
      } else if (code !== 0) {
        reject(new Error(`Task '${taskName}' exited with code ${code}`));
      } else {
        resolve();
      }
    });

    // Handle task process errors
    taskProcess.on('error', error => {
      reject(new Error(`Failed to spawn task '${taskName}': ${error.message}`));
    });
  });
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
  executeTask(taskName).catch(error => {
    // Task file not found or spawn failed
    if (error.message.includes('Failed to spawn')) {
      showHelp();
      logError(error.message);
    } else {
      // Task execution failed
      const verbose = isVerbose();
      let errorMessage = `\n🚫 ${error.message}`;

      if (verbose && error.stack) {
        errorMessage += `\n\nStack trace:\n${error.stack}`;
      }

      logError(errorMessage);
    }
    process.exit(1);
  });
}

module.exports = main;
