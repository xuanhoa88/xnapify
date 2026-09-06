/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// @rspack/core ships ESM only and is not transformed for jest. The plugin
// touches two values from it, both stubbed here.
jest.mock('@rspack/core', () => ({
  rspack: {
    Compilation: { PROCESS_ASSETS_STAGE_OPTIMIZE_TRANSFER: 400 },
    sources: {
      RawSource: class RawSource {
        constructor(value) {
          this.value = value;
        }
        source() {
          return this.value;
        }
      },
    },
  },
}));

import PrecompressPlugin, { mapWithConcurrency } from './PrecompressPlugin.js';

/** Yield to the macrotask queue so overlapping work is observable. */
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

/**
 * Wire a plugin to a stub compiler and hand back the processAssets callback.
 */
function tapPlugin(plugin, compilation) {
  let run;
  compilation.hooks = {
    processAssets: {
      tapPromise: (_options, fn) => {
        run = fn;
      },
    },
  };
  plugin.apply({
    hooks: { thisCompilation: { tap: (_name, fn) => fn(compilation) } },
  });
  return run;
}

/** Compilation stub holding `count` compressible assets. */
function stubCompilation(count) {
  const emitted = new Map();
  const assets = Array.from({ length: count }, (_, i) => ({
    name: `asset-${i}.js`,
    source: { source: () => 'x'.repeat(4096) },
  }));

  return {
    getAssets: () => assets,
    getAsset: name => emitted.get(name) || null,
    emitAsset: (name, source) => emitted.set(name, source),
    updateAsset: (name, source) => emitted.set(name, source),
    emitted,
  };
}

describe('mapWithConcurrency', () => {
  it('never runs more than the limit at once', async () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    let inFlight = 0;
    let peak = 0;

    await mapWithConcurrency(items, 3, async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await tick();
      inFlight -= 1;
    });

    expect(peak).toBe(3);
    expect(inFlight).toBe(0);
  });

  it('processes every item exactly once', async () => {
    const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const seen = [];

    await mapWithConcurrency(items, 2, async item => {
      await tick();
      seen.push(item);
    });

    expect(seen.sort()).toEqual([...items].sort());
  });

  it('does not spin up more lanes than there are items', async () => {
    let inFlight = 0;
    let peak = 0;

    await mapWithConcurrency([1, 2], 16, async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await tick();
      inFlight -= 1;
    });

    expect(peak).toBe(2);
  });

  it('tolerates an empty list', async () => {
    const worker = jest.fn();

    await expect(mapWithConcurrency([], 4, worker)).resolves.toBeUndefined();
    expect(worker).not.toHaveBeenCalled();
  });
});

describe('PrecompressPlugin', () => {
  it('defaults to a bounded limit rather than the whole asset list', () => {
    const { concurrency } = new PrecompressPlugin();
    expect(concurrency).toBeGreaterThanOrEqual(1);
    expect(concurrency).toBeLessThanOrEqual(16);
  });

  it('honours an explicit concurrency and never drops below one worker', () => {
    expect(new PrecompressPlugin({ concurrency: 2 }).concurrency).toBe(2);
    expect(new PrecompressPlugin({ concurrency: 0 }).concurrency).toBe(1);
    expect(new PrecompressPlugin({ concurrency: -5 }).concurrency).toBe(1);
  });

  // Regression: every asset used to be dispatched at once, queueing the whole
  // build on the four-thread libuv pool and holding every compressed buffer
  // in memory at the same time.
  it('compresses assets in bounded batches, not all at once', async () => {
    const plugin = new PrecompressPlugin({ concurrency: 2 });
    const compilation = stubCompilation(12);
    const run = tapPlugin(plugin, compilation);

    let inFlight = 0;
    let peak = 0;
    plugin.compressAsset = async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await tick();
      inFlight -= 1;
    };

    await run();

    expect(peak).toBe(2);
    expect(inFlight).toBe(0);
  });

  it('still compresses every eligible asset', async () => {
    const plugin = new PrecompressPlugin({ concurrency: 3 });
    const compilation = stubCompilation(7);
    const run = tapPlugin(plugin, compilation);

    await run();

    const names = Array.from(compilation.emitted.keys()).sort();
    expect(names).toHaveLength(14); // 7 assets × (.br + .gz)
    expect(names).toContain('asset-0.js.br');
    expect(names).toContain('asset-6.js.gz');
  });
});
