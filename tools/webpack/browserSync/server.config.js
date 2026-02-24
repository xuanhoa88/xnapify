/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

const open = require('open');
const { logInfo, logWarn, logError } = require('../../utils/logger');

// Configuration
const CONFIG = Object.freeze({
  BROADCAST_RETRY_ATTEMPTS: 3,
  BROADCAST_RETRY_DELAY: 100, // 100ms
  RESTART_NOTIFICATION_DELAY: 1 * 1000, // 1 second
  SHUTDOWN_DELAY: 1 * 1000, // 1 second
  BROWSER_KILL_TIMEOUT: 5 * 1000, // 5 seconds
  CLIENT_WAIT_TIMEOUT: 3 * 1000, // Wait 3 seconds for existing client to reconnect
});

// State management
let hotMiddleware = null;
let browserProcess = null;
let isRestarting = false;
let isShuttingDown = false;
let pendingBrowserOpen = null; // Pending timeout for opening browser
let serverRef = null; // Reference to server for deferred browser open

/**
 * Validate server object
 * @param {object} server - Express server instance
 * @returns {boolean}
 */
function isValidServer(server) {
  if (!server) {
    logError('[BrowserSync] Invalid server: server is null/undefined');
    return false;
  }

  if (typeof server.address !== 'function') {
    logError('[BrowserSync] Invalid server: missing address() method');
    return false;
  }

  const address = server.address();
  if (!address || typeof address !== 'object') {
    logError('[BrowserSync] Invalid server: address() returned invalid data');
    return false;
  }

  if (!address.port) {
    logError('[BrowserSync] Invalid server: no port available');
    return false;
  }

  return true;
}

/**
 * Broadcast message to all connected clients via HMR middleware
 * @param {object} data - Message data to broadcast
 * @param {number} retries - Number of retry attempts remaining
 * @returns {Promise<boolean>}
 */
const broadcast = async (data, retries = CONFIG.BROADCAST_RETRY_ATTEMPTS) => {
  if (!data || typeof data !== 'object') {
    logWarn('[BrowserSync] Invalid broadcast data');
    return false;
  }

  if (!hotMiddleware) {
    logWarn('[BrowserSync] Cannot broadcast: HMR middleware not initialized');
    return false;
  }

  try {
    // Ensure the middleware has the publish method
    if (typeof hotMiddleware.publish !== 'function') {
      logError('[BrowserSync] HMR middleware missing publish() method');
      return false;
    }

    // Add timestamp if not present
    const message = {
      ...data,
      timestamp: data.timestamp || Date.now(),
    };

    hotMiddleware.publish(message);
    logInfo(`[BrowserSync] Broadcasted: ${message.type}`);
    return true;
  } catch (error) {
    logWarn(`[BrowserSync] Broadcast error: ${error.message}`);

    // Retry logic
    if (retries > 0) {
      logInfo(`[BrowserSync] Retrying broadcast (${retries} attempts left)...`);
      await new Promise(resolve =>
        setTimeout(resolve, CONFIG.BROADCAST_RETRY_DELAY),
      );
      return broadcast(data, retries - 1);
    }

    logError('[BrowserSync] Broadcast failed after all retries');
    return false;
  }
};

/**
 * Get the server URL
 * @param {object} server - Express server instance
 * @returns {string|null}
 */
function getServerUrl(server) {
  if (!isValidServer(server)) {
    return null;
  }

  try {
    const { address, port } = server.address();
    let host = address;
    // Map IPv6 loopback addresses to localhost for browser compatibility
    if (address === '::' || address === '::1') {
      host = 'localhost';
    }
    return `http://${host}:${port}`;
  } catch (error) {
    logError(`[BrowserSync] Failed to get server URL: ${error.message}`);
    return null;
  }
}

/**
 * Open the default browser to the dev server URL
 * @param {object} server - Express server instance
 * @returns {Promise<boolean>}
 */
const openBrowser = async server => {
  const url = getServerUrl(server);

  if (!url) {
    logError('[BrowserSync] Cannot open browser: invalid server URL');
    return false;
  }

  try {
    logInfo(`[BrowserSync] Opening browser at ${url}...`);
    const proc = await open(url);

    if (proc && typeof proc.kill === 'function') {
      browserProcess = proc;
      logInfo(`[BrowserSync] Browser opened (PID: ${proc.pid})`);
    } else {
      browserProcess = null;
      logInfo(`[BrowserSync] Browser opened (no process handle)`);
    }

    return true;
  } catch (error) {
    logWarn(`[BrowserSync] Failed to open browser: ${error.message}`);
    logInfo(`[BrowserSync] Please manually open: ${url}`);
    return false;
  }
};

/**
 * Close the browser process with timeout
 */
const closeBrowser = () => {
  if (!browserProcess || browserProcess.killed) {
    return;
  }

  try {
    const { pid } = browserProcess;
    browserProcess.kill('SIGKILL');
    logInfo(`[BrowserSync] Sent SIGKILL to browser (PID: ${pid})`);
  } catch (err) {
    logWarn(`[BrowserSync] Error closing browser: ${err.message}`);
  } finally {
    browserProcess = null;
  }
};

/**
 * Initialize BrowserSync with HMR middleware
 * @param {object} middleware - Webpack HMR middleware
 * @returns {boolean}
 */
const initialize = middleware => {
  if (!middleware) {
    logError('[BrowserSync] Cannot initialize: middleware is null/undefined');
    return false;
  }

  if (typeof middleware.publish !== 'function') {
    logError(
      '[BrowserSync] Cannot initialize: middleware missing publish() method',
    );
    return false;
  }

  hotMiddleware = middleware;
  logInfo('[BrowserSync] Initialized with HMR middleware');
  return true;
};

/**
 * Notify clients about server restart
 * @returns {Promise<boolean>}
 */
const notifyRestart = async () => {
  if (isShuttingDown) {
    logWarn('[BrowserSync] Cannot notify restart: server is shutting down');
    return false;
  }

  isRestarting = true;

  const success = await broadcast({
    type: 'browser_sync_server_restarting',
  });

  if (!success) {
    logWarn('[BrowserSync] Failed to notify clients about restart');
  }

  return success;
};

/**
 * Notify clients that server is ready
 * @param {boolean} reload - Whether to reload clients
 * @returns {Promise<boolean>}
 */
const notifyReady = async (reload = true) => {
  if (isShuttingDown) {
    logWarn('[BrowserSync] Cannot notify ready: server is shutting down');
    return false;
  }

  isRestarting = false;

  const success = await broadcast({
    type: 'browser_sync_server_ready',
    action: reload ? 'reload' : 'clear_overlay',
  });

  if (!success) {
    logWarn('[BrowserSync] Failed to notify clients that server is ready');
  }

  return success;
};

/**
 * Force reload all clients
 * @returns {Promise<boolean>}
 */
const reloadClients = async () => {
  if (isShuttingDown) {
    logWarn('[BrowserSync] Cannot reload: server is shutting down');
    return false;
  }

  const success = await broadcast({
    type: 'browser_sync_reload',
  });

  if (!success) {
    logWarn('[BrowserSync] Failed to reload clients');
  }

  return success;
};

/**
 * Cancel pending browser open (called when client connects)
 */
const onClientConnected = () => {
  if (pendingBrowserOpen) {
    clearTimeout(pendingBrowserOpen);
    pendingBrowserOpen = null;
    logInfo('[BrowserSync] Client reconnected, cancelled browser open');
  }
};

/**
 * Start dev mode: initialize and schedule browser open
 * Browser opens after timeout unless a client reconnects first
 * @param {object} server - Express server instance
 * @param {object} middleware - Webpack HMR middleware
 * @returns {Promise<boolean>}
 */
const start = async (server, middleware) => {
  if (isShuttingDown) {
    logError('[BrowserSync] Cannot start: server is shutting down');
    return false;
  }

  logInfo('[BrowserSync] Starting...');

  // Validate inputs
  if (!isValidServer(server)) {
    return false;
  }

  // Initialize middleware
  if (!initialize(middleware)) {
    return false;
  }

  // Store server reference for deferred browser open
  serverRef = server;

  // Schedule browser open after timeout
  // If a client reconnects before timeout, it will be cancelled
  logInfo(
    `[BrowserSync] Waiting ${CONFIG.CLIENT_WAIT_TIMEOUT}ms for existing client...`,
  );

  pendingBrowserOpen = setTimeout(async () => {
    pendingBrowserOpen = null;
    logInfo('[BrowserSync] No client reconnected, opening browser...');
    await openBrowser(serverRef);
  }, CONFIG.CLIENT_WAIT_TIMEOUT);

  logInfo('[BrowserSync] Start complete');
  return true;
};

/**
 * Handle server restart flow
 * @param {object} server - Express server instance
 * @param {object} middleware - Webpack HMR middleware (optional)
 * @returns {Promise<boolean>}
 */
const restart = async (server, middleware) => {
  if (isShuttingDown) {
    logError('[BrowserSync] Cannot restart: server is shutting down');
    return false;
  }

  logInfo('[BrowserSync] Server restart initiated');

  // Re-initialize middleware reference if provided
  if (middleware && !initialize(middleware)) {
    logWarn('[BrowserSync] Restart continuing with existing middleware');
  }

  // Validate server
  if (!isValidServer(server)) {
    logError('[BrowserSync] Restart failed: invalid server');
    return false;
  }

  // Wait for server to stabilize
  await new Promise(resolve =>
    setTimeout(resolve, CONFIG.RESTART_NOTIFICATION_DELAY),
  );

  // Notify clients
  const success = await notifyReady(true);

  if (success) {
    logInfo('[BrowserSync] Restart complete');
  } else {
    logWarn('[BrowserSync] Restart completed with warnings');
  }

  return success;
};

/**
 * Graceful shutdown with proper async handling
 * @returns {Promise<void>}
 */
const shutdown = async () => {
  if (isShuttingDown) {
    logWarn('[BrowserSync] Shutdown already in progress');
    return;
  }

  isShuttingDown = true;
  logInfo('[BrowserSync] Shutdown initiated');

  try {
    // Notify clients to close
    await broadcast({
      type: 'browser_sync_server_shutdown',
    });

    // Allow time for broadcast to be sent
    await new Promise(resolve => setTimeout(resolve, CONFIG.SHUTDOWN_DELAY));

    // Close browser process
    await closeBrowser();

    // Clean up state
    hotMiddleware = null;
    isRestarting = false;

    logInfo('[BrowserSync] Shutdown complete');
  } catch (error) {
    logError(`[BrowserSync] Error during shutdown: ${error.message}`);
  } finally {
    isShuttingDown = false;
  }
};

/**
 * Get current state for debugging
 * @returns {object}
 */
const getState = () => ({
  hasHotMiddleware: !!hotMiddleware,
  isRestarting,
  isShuttingDown,
  hasBrowserProcess: !!browserProcess,
  browserPid: (browserProcess && browserProcess.pid) || null,
});

module.exports = {
  notifyRestart,
  notifyReady,
  reloadClients,
  onClientConnected,
  start,
  restart,
  shutdown,
  getState,
};
