/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Centralized Shutdown Registry
 *
 * Collects cleanup functions from all engine factories and executes them
 * in a single coordinated pass during process teardown.
 *
 * ## Why this exists
 *
 * Engine singletons are created at module-evaluation time via `createFactory()`.
 * During Webpack HMR the server bundle is re-evaluated, which re-imports every
 * engine `index.js`. If each factory registered its own `process.once('SIGTERM')`
 * handler, every hot-reload would stack a *new* listener (the closure reference
 * is unique each time). After N reloads the process exit would fire N+1 cleanup
 * routines per engine — the exact bug this registry fixes.
 *
 * `Map.set(name, entry)` is idempotent: re-imports overwrite the same key
 * instead of appending duplicates. Zero signal handlers, zero `globalThis` hacks.
 *
 * ## Execution model
 *
 * Handlers are assigned a numeric `position` (default `0`). During shutdown:
 *
 * 1. Handlers are sorted **high → low** by position.
 * 2. Handlers sharing the same position run **in parallel** (`Promise.allSettled`).
 * 3. Position batches execute **sequentially** (high position completes before
 *    the next lower batch starts).
 *
 * This lets you express ordering constraints declaratively:
 *
 * ```
 * Position 20 ─ http        (stop accepting traffic first)
 * Position 10 ─ queue, hook (drain in-flight work)
 * Position  0 ─ cache, db   (close resources last)
 * ```
 *
 * ## Usage
 *
 * ```js
 * // In engine factory
 * import { register } from '../shutdown';
 *
 * export function createFactory(config) {
 *   const engine = new Engine(config);
 *   register('myEngine', () => engine.cleanup(), 10);
 *   return engine;
 * }
 *
 * // In server teardown
 * await shutdown();
 * ```
 */

/** Default shutdown timeout (ms) — prevents hung handlers from blocking exit */
const DEFAULT_TIMEOUT = 30_000;

/** @type {Map<string, { fn: Function, position: number }>} */
const handlers = new Map();

/** Guard against concurrent / re-entrant shutdown calls */
let isShuttingDown = false;

/**
 * Register a named cleanup handler.
 *
 * Idempotent — calling `register('email', fn)` twice simply overwrites
 * the previous reference instead of accumulating duplicates.
 *
 * @param {string}   name     - Unique engine identifier (e.g. 'email', 'queue')
 * @param {Function} fn       - Async-safe cleanup function
 * @param {number}   position - Priority (default 0). Higher runs first.
 */
export function register(name, fn, position = 0) {
  if (!name || typeof name !== 'string') {
    throw new TypeError('ShutdownRegistry: name must be a non-empty string');
  }
  if (typeof fn !== 'function') {
    throw new TypeError(
      `ShutdownRegistry: handler for "${name}" must be a function`,
    );
  }
  handlers.set(name, { fn, position });
}

/**
 * Remove a named cleanup handler.
 *
 * @param {string} name - Engine identifier to remove
 * @returns {boolean} True if the handler existed and was removed
 */
export function unregister(name) {
  return handlers.delete(name);
}

/**
 * Execute all registered cleanup handlers.
 *
 * Handlers are grouped by position (high → low) and each group runs
 * in parallel via `Promise.allSettled`. A single failure does not
 * prevent remaining engines from shutting down cleanly.
 *
 * @param {Object}  [options]
 * @param {number}  [options.timeout=30000] - Global timeout (ms). If all
 *   handlers haven't completed within this window the function resolves
 *   anyway so the process can exit.
 * @returns {Promise<void>}
 */
export async function shutdown({ timeout = DEFAULT_TIMEOUT } = {}) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  try {
    await executeHandlers(timeout);
  } finally {
    handlers.clear();
    isShuttingDown = false;
  }
}

/**
 * Internal: run all handlers with a global timeout guard.
 * Extracted so `shutdown()` can wrap it in try/finally.
 *
 * @param {number} timeout - Global deadline in milliseconds
 * @returns {Promise<void>}
 * @private
 */
async function executeHandlers(timeout) {
  // Sort entries high → low by position
  const sorted = [...handlers.entries()].sort(
    (a, b) => b[1].position - a[1].position,
  );

  // Group into batches of equal position
  const batches = [];
  for (const [name, entry] of sorted) {
    const last = batches[batches.length - 1];
    if (!last || last[0][1].position !== entry.position) {
      batches.push([[name, entry]]);
    } else {
      last.push([name, entry]);
    }
  }

  // Race the entire batch sequence against a global deadline
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Shutdown timed out after ${timeout}ms`));
    }, timeout);
  });

  try {
    await Promise.race([runBatches(batches), deadline]);
  } catch (err) {
    console.error(`❌ ${err.message}`);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Internal: execute batches sequentially, handlers within each batch in parallel.
 *
 * @param {Array} batches
 * @returns {Promise<void>}
 * @private
 */
async function runBatches(batches) {
  for (const batch of batches) {
    await Promise.allSettled(
      batch.map(([name, { fn }]) =>
        Promise.resolve()
          .then(() => fn())
          .catch(err => {
            console.error(`❌ Shutdown error [${name}]:`, err.message);
          }),
      ),
    );
  }
}

/**
 * Return the list of currently registered engine names.
 * Useful for diagnostics and testing.
 *
 * @returns {string[]}
 */
export function getRegisteredEngines() {
  return [...handlers.keys()];
}
