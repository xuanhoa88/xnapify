/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Default parallelism for filesystem fan-out.
 *
 * `Promise.all(entries.map(...))` over a directory opens one descriptor per
 * entry at once. That is fine for the twelve files a developer has locally and
 * fatal for the fifty thousand a production cache accumulates: the process hits
 * EMFILE, and because the failure lands on unrelated `open` calls elsewhere it
 * surfaces as a burst of seemingly random errors across the whole app.
 *
 * 32 keeps the disk busy while staying far under the default 256-descriptor
 * soft limit on macOS and the 1024 typical on Linux.
 */
export const DEFAULT_CONCURRENCY = 32;

/**
 * Map over `items` with at most `limit` operations in flight.
 *
 * Unlike `Promise.all`, a rejection does not abandon the remaining work with no
 * one watching it — every task is settled before this resolves, and failures
 * come back as values. Callers decide what a partial failure means; for
 * housekeeping it is usually "log and carry on", and for a batch write it is
 * usually "roll back".
 *
 * @template T, R
 * @param {Iterable<T>} items
 * @param {(item: T, index: number) => Promise<R>} fn
 * @param {number} [limit=32]
 * @returns {Promise<Array<{ status: 'fulfilled', value: R } | { status: 'rejected', reason: Error, item: T }>>}
 */
export async function mapLimit(items, fn, limit = DEFAULT_CONCURRENCY) {
  const list = Array.isArray(items) ? items : Array.from(items);
  const results = new Array(list.length);
  let cursor = 0;

  const worker = async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= list.length) return;
      try {
        results[index] = {
          status: 'fulfilled',
          value: await fn(list[index], index),
        };
      } catch (reason) {
        results[index] = { status: 'rejected', reason, item: list[index] };
      }
    }
  };

  const width = Math.max(1, Math.min(limit, list.length));
  await Promise.all(Array.from({ length: width }, worker));
  return results;
}
