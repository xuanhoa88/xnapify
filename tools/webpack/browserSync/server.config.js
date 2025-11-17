/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import WebSocket from 'ws';
import open from 'open';
import { BuildError } from '../../lib/errorHandler';
import { logInfo, logError, logWarn } from '../../lib/logger';

// State management
let wss = null;
let clients = new Set();
let heartbeatInterval = null;
let isRestarting = false;
let browserProcess = null;
let currentServer = null;

/**
 * Send JSON message to a specific client
 */
const send = (ws, data) => {
  if (ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify(data));
      return true;
    } catch (err) {
      logError('[BrowserSync] Send error:', err.message);
      return false;
    }
  }
  return false;
};

/**
 * Broadcast message to all connected clients
 */
const broadcast = data => {
  let count = 0;
  clients.forEach(ws => {
    if (send(ws, data)) count++;
  });
  if (count > 0) {
    logInfo(`[BrowserSync] Broadcast "${data.type}" to ${count} client(s)`);
  }
  return count;
};

/**
 * Handle incoming client messages
 */
const handleMessage = (ws, data) => {
  try {
    const msg = JSON.parse(data.toString());

    switch (msg.type) {
      case 'browser_sync_ping':
        send(ws, { type: 'browser_sync_pong', timestamp: Date.now() });
        break;

      case 'browser_sync_client_ready':
        logInfo('[BrowserSync] Client ready');
        if (isRestarting) {
          send(ws, {
            type: 'browser_sync_server_ready',
            action: 'clear_overlay',
          });
          isRestarting = false;
        }
        break;

      case 'browser_sync_status':
        send(ws, {
          type: 'browser_sync_status_response',
          isRestarting,
          clientCount: clients.size,
          timestamp: Date.now(),
        });
        break;

      default:
        logInfo('[BrowserSync] Unknown message:', msg.type);
    }
  } catch (err) {
    logError('[BrowserSync] Invalid message:', err.message);
  }
};

/**
 * Setup client connection handlers
 */
const setupClient = ws => {
  clients.add(ws);
  ws.isAlive = true;

  logInfo(`[BrowserSync] Client connected (${clients.size} active)`);

  // Send connection confirmation
  send(ws, { type: 'browser_sync_connected', timestamp: Date.now() });

  // Message handler
  ws.on('message', data => handleMessage(ws, data));

  // Pong handler for heartbeat
  ws.on('browser_sync_pong', () => {
    ws.isAlive = true;
  });

  // Cleanup on close
  ws.on('close', () => {
    clients.delete(ws);
    logInfo(`[BrowserSync] Client disconnected (${clients.size} active)`);
  });

  // Error handler
  ws.on('error', err => {
    logError('[BrowserSync] Client error:', err.message);
    clients.delete(ws);
  });
};

/**
 * Start heartbeat to detect dead connections
 */
const startHeartbeat = () => {
  stopHeartbeat();

  heartbeatInterval = setInterval(() => {
    if (wss && Array.isArray(wss.clients)) {
      wss.clients.forEach(ws => {
        if (!ws.isAlive) {
          clients.delete(ws);
          ws.terminate();
          return;
        }
        ws.isAlive = false;
        ws.ping();
      });
    }
  }, 30000);
};

/**
 * Stop heartbeat interval
 */
const stopHeartbeat = () => {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
};

/**
 * Initialize WebSocket server
 */
const initialize = server => {
  // If server instance changed, recreate WebSocket server
  const serverChanged = currentServer !== server;

  if (serverChanged && wss) {
    logInfo('[BrowserSync] HTTP server changed, recreating WebSocket server');
    stopHeartbeat();
    wss.removeAllListeners();
    wss.close();
    wss = null;
  }

  currentServer = server;

  // Don't reinitialize if already exists with same server
  if (wss && !serverChanged) {
    logInfo('[BrowserSync] Already initialized');
    return;
  }

  try {
    wss = new WebSocket.Server({
      server,
      path: '/~/__bs',
      clientTracking: true,
    });

    wss.on('connection', setupClient);

    wss.on('error', err => {
      logError('[BrowserSync] Server error:', err.message);
      // Don't throw on runtime errors, just log
      if (err.code !== 'EADDRINUSE') {
        logWarn('[BrowserSync] Non-fatal error, continuing...');
      }
    });

    wss.on('close', () => {
      stopHeartbeat();
      logInfo('[BrowserSync] Server closed');
    });

    startHeartbeat();
    logInfo('[BrowserSync] Server initialized');
  } catch (err) {
    throw new BuildError(`Failed to create WebSocket server: ${err.message}`, {
      suggestion:
        'Port may be in use. Try a different port or kill the process.',
    });
  }
};

/**
 * Open the default browser to the dev server URL
 */
const openBrowser = async server => {
  const { address, port } = server.address();
  const host = address === '::' ? 'localhost' : address;

  const url = `http://${host}:${port}`;

  try {
    const proc = await open(url);
    if (proc && typeof proc.kill === 'function') {
      browserProcess = proc;
      logInfo(`[BrowserSync] Opened browser at ${url} (PID: ${proc.pid})`);
    } else {
      browserProcess = null;
      logInfo(`[BrowserSync] Opened browser at ${url}`);
    }
  } catch (error) {
    logWarn(`[BrowserSync] Failed to open browser: ${error.message}`);
    logInfo(`[BrowserSync] Please manually open: ${url}`);
  }
};

/**
 * Close the browser process
 */
const closeBrowser = () => {
  if (!browserProcess || browserProcess.killed) {
    return;
  }

  try {
    if (typeof browserProcess.kill === 'function') {
      browserProcess.kill('SIGTERM');
      logInfo(`[BrowserSync] Closed browser (PID: ${browserProcess.pid})`);
      browserProcess = null;
    }
  } catch (err) {
    logWarn(`[BrowserSync] Failed to close browser: ${err.message}`);
  }
};

/**
 * Check if any clients are connected
 */
const hasClients = () => clients.size > 0;

/**
 * Get current client count
 */
export const getClientCount = () => clients.size;

/**
 * Notify clients about server restart
 */
export const notifyRestart = () => {
  if (!hasClients()) {
    logInfo('[BrowserSync] No clients to notify about restart');
    return 0;
  }

  isRestarting = true;
  return broadcast({
    type: 'browser_sync_server_restarting',
    timestamp: Date.now(),
  });
};

/**
 * Notify clients that server is ready
 */
export const notifyReady = (reload = true) => {
  if (!hasClients()) {
    logInfo('[BrowserSync] No clients to notify');
    isRestarting = false;
    return 0;
  }

  isRestarting = false;
  return broadcast({
    type: 'browser_sync_server_ready',
    action: reload ? 'reload' : 'clear_overlay',
    timestamp: Date.now(),
  });
};

/**
 * Force reload all clients
 */
export const reloadClients = () =>
  broadcast({
    type: 'browser_sync_reload',
    timestamp: Date.now(),
  });

/**
 * Start dev mode: initialize WS and open browser if needed
 */
export const start = async server => {
  initialize(server);

  // Wait for potential client reconnections
  await new Promise(resolve => setTimeout(resolve, 500));

  if (hasClients()) {
    logInfo('[BrowserSync] Active clients detected, skipping browser open');
    notifyReady(true);
    return false;
  }

  logInfo('[BrowserSync] No active clients, opening browser');
  await openBrowser(server);
  return true;
};

/**
 * Handle server restart flow
 */
export const restart = async server => {
  logInfo('[BrowserSync] Server restart initiated');

  // Re-initialize WebSocket with new server instance
  initialize(server);

  // Wait for clients to reconnect
  await new Promise(resolve => setTimeout(resolve, 1000));

  if (hasClients()) {
    logInfo('[BrowserSync] Clients detected after restart, notifying them');
    notifyReady(true);
  } else {
    logInfo('[BrowserSync] No clients detected, opening browser');
    await openBrowser(server);
  }
};

/**
 * Graceful shutdown with proper async handling
 */
export const shutdown = () => {
  // Cleanup function: always safe to call
  const cleanup = () => {
    closeBrowser();

    if (clients) clients.clear();
    wss = null;
    currentServer = null;
    logInfo('[BrowserSync] Shutdown complete');
  };

  // Already shut down → just cleanup and return
  if (!wss) {
    logInfo('[BrowserSync] Already shut down');
    return cleanup();
  }

  logInfo('[BrowserSync] Shutting down...');

  // Notify connected clients to close tabs
  broadcast({
    type: 'browser_sync_server_shutdown',
    action: 'close_tab',
    timestamp: Date.now(),
  });

  // Stop heartbeat timer
  stopHeartbeat();

  // Close a single WebSocket client with timeout fallback
  const closeClients = () => {
    const clientsArray = Array.from(wss.clients || []);
    return clientsArray.map(ws => {
      // Determine client identifier (IP:Port or custom id)
      const clientName =
        // eslint-disable-next-line no-underscore-dangle
        (ws._socket &&
          // eslint-disable-next-line no-underscore-dangle
          ws._socket.remoteAddress + ':' + ws._socket.remotePort) ||
        ws.id ||
        'unknown-client';

      return new Promise(resolve => {
        // Already closed → resolve immediately
        if (ws.readyState === WebSocket.CLOSED) {
          logInfo(
            `[BrowserSync] Client ${clientName} already closed, skipping.`,
          );
          return resolve();
        }

        // Timeout fallback so shutdown never hangs
        const timeout = setTimeout(() => {
          logInfo(
            `[BrowserSync] Client ${clientName} close timeout, resolving.`,
          );
          resolve();
        }, 1000);

        // Called when client is closed or errors
        const done = () => {
          clearTimeout(timeout);
          logInfo(`[BrowserSync] Client ${clientName} closed.`);
          resolve();
        };

        // Listen for client close and error events
        ws.once('close', done);
        ws.once('error', done);

        // Attempt graceful close
        try {
          ws.close(1000, 'Server shutdown');
          logInfo(`[BrowserSync] Closing client ${clientName}...`);
        } catch (err) {
          logInfo(
            `[BrowserSync] Error closing client ${clientName}, resolving.`,
          );
          done();
        }
      });
    });
  };

  // Create all async shutdown tasks
  const tasks = [
    // Close all WebSocket clients
    ...closeClients(),

    // Close the WebSocket server
    new Promise(res => {
      wss.removeAllListeners();
      wss.close(err => {
        if (err) {
          logWarn('[BrowserSync] Server close error:', err.message);
        }
        res();
      });
    }),

    // Cleanup (added as a Promise to run inside allSettled)
    new Promise(res => {
      cleanup();
      res();
    }),
  ];

  // Wait for *all* shutdown operations to finish (no rejections)
  return Promise.allSettled(tasks);
};

/**
 * Get current state for debugging
 */
export const getState = () => ({
  hasWebSocketServer: !!wss,
  clientCount: clients.size,
  isRestarting,
  hasBrowserProcess: !!browserProcess,
});
