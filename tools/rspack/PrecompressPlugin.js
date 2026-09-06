/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { promisify } from 'util';
import zlib from 'zlib';

import { rspack } from '@rspack/core';

const brotli = promisify(zlib.brotliCompress);
const gzip = promisify(zlib.gzip);

const PLUGIN_NAME = 'PrecompressPlugin';

/**
 * Assets compressed at a time.
 *
 * `zlib`'s async API runs on the libuv threadpool, four threads by default.
 * Dispatching every asset at once therefore buys no extra parallelism: it
 * only queues hundreds of jobs while holding every compressed buffer in
 * memory and starving rspack's own file IO of threadpool slots.
 */
const DEFAULT_CONCURRENCY =
  Number.parseInt(process.env.UV_THREADPOOL_SIZE, 10) || 4;

/**
 * Run an async worker over items, never more than `limit` at a time.
 *
 * @template T
 * @param {T[]} items - Work items
 * @param {number} limit - Maximum in-flight workers
 * @param {(item: T) => Promise<void>} worker - Per-item task
 * @returns {Promise<void>}
 */
export async function mapWithConcurrency(items, limit, worker) {
  let next = 0;
  const lanes = Math.max(1, Math.min(limit, items.length));

  await Promise.all(
    Array.from({ length: lanes }, async () => {
      // `next++` is atomic here: there is no await between read and write.
      while (next < items.length) {
        await worker(items[next++]);
      }
    }),
  );
}

/**
 * Emit `.br` and `.gz` siblings for compressible assets at build time.
 *
 * Runtime compression re-encodes the same immutable bytes on every request
 * (a 1 MB vendor bundle costs ~80 ms of CPU per hit). Precompressing once at
 * build time and serving the variant that matches `Accept-Encoding` removes
 * that cost entirely and lets brotli run at its highest quality, which the
 * runtime middleware cannot afford.
 *
 * Pair with `createPrecompressedStatic()` from
 * `shared/api/engines/http/precompressed.js` on the serving side.
 */
class PrecompressPlugin {
  /**
   * @param {Object} [options]
   * @param {RegExp} [options.test] - Assets to compress
   * @param {number} [options.threshold=1024] - Skip assets smaller than this (bytes)
   * @param {number} [options.minRatio=0.9] - Skip variants that do not shrink below this ratio
   * @param {Array<'br'|'gz'>} [options.algorithms] - Variants to emit
   * @param {number} [options.brotliQuality=10] - Brotli quality (0-11); env XNAPIFY_PRECOMPRESS_BROTLI_QUALITY overrides
   * @param {number} [options.concurrency] - Assets compressed at a time; defaults to the libuv threadpool size
   */
  constructor(options = {}) {
    this.test =
      options.test || /\.(?:m?js|css|svg|json|txt|xml|webmanifest|html?)$/i;
    this.threshold = options.threshold ?? 1024;
    this.minRatio = options.minRatio ?? 0.9;
    this.algorithms = options.algorithms || ['br', 'gz'];
    // Quality 11 is ~2% smaller than 10 but roughly twice as slow, and a
    // full build compresses tens of megabytes. 10 keeps CI builds fast;
    // override per environment when the last percent matters.
    const envQuality = parseInt(
      process.env.XNAPIFY_PRECOMPRESS_BROTLI_QUALITY,
      10,
    );
    this.brotliQuality = Number.isInteger(envQuality)
      ? Math.min(Math.max(envQuality, 0), zlib.constants.BROTLI_MAX_QUALITY)
      : (options.brotliQuality ?? 10);
    this.concurrency = Math.max(1, options.concurrency ?? DEFAULT_CONCURRENCY);
  }

  /**
   * @param {import('@rspack/core').Compiler} compiler
   */
  apply(compiler) {
    compiler.hooks.thisCompilation.tap(PLUGIN_NAME, compilation => {
      compilation.hooks.processAssets.tapPromise(
        {
          name: PLUGIN_NAME,
          stage: rspack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_TRANSFER,
        },
        async () => {
          const assets = compilation
            .getAssets()
            .filter(
              asset =>
                this.test.test(asset.name) && !/\.(?:br|gz)$/i.test(asset.name),
            );

          await mapWithConcurrency(assets, this.concurrency, asset =>
            this.compressAsset(compilation, asset),
          );
        },
      );
    });
  }

  /**
   * @param {import('@rspack/core').Compilation} compilation
   * @param {{ name: string, source: { source(): string|Buffer } }} asset
   */
  async compressAsset(compilation, asset) {
    const raw = asset.source.source();
    const input = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
    if (input.length < this.threshold) return;

    for (const algorithm of this.algorithms) {
      const output =
        algorithm === 'br'
          ? await brotli(input, {
              params: {
                [zlib.constants.BROTLI_PARAM_QUALITY]: this.brotliQuality,
                [zlib.constants.BROTLI_PARAM_SIZE_HINT]: input.length,
              },
            })
          : await gzip(input, { level: zlib.constants.Z_BEST_COMPRESSION });

      if (output.length / input.length > this.minRatio) continue;

      const name = `${asset.name}.${algorithm}`;
      if (compilation.getAsset(name)) {
        compilation.updateAsset(name, new rspack.sources.RawSource(output));
      } else {
        compilation.emitAsset(name, new rspack.sources.RawSource(output), {
          compressed: true,
          minimized: true,
        });
      }
    }
  }
}

export default PrecompressPlugin;
