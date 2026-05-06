/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import Module from 'module';

import NodeEnvironment from 'jest-environment-node';

import requireContext from './requireContextPolyfill.js';

// ─── Outer-context prototype patches ──────────────────────────────────────────
// Jest creates per-module `require` functions in the OUTER Node.js context
// (jest-runtime), then passes them into the VM sandbox. Because these functions
// originate from a different realm, they do NOT inherit from the sandbox's
// Function.prototype or Object.prototype.
//
// We must patch the OUTER context's prototypes here (top-level code in this
// file runs in the outer Node process) so that `require.context(...)` resolves
// via the prototype chain on Jest's cross-realm require functions.

// Attach to Module.prototype.require (Node's native module loader).
if (
  Module &&
  Module.prototype &&
  typeof Module.prototype.require === 'function'
) {
  Module.prototype.require.context = requireContext;
}

// Attach to the outer Function.prototype so Jest's require functions inherit it.
if (typeof Function !== 'undefined' && Function.prototype) {
  Object.defineProperty(Function.prototype, 'context', {
    value: requireContext,
    configurable: true,
    writable: true,
  });
}

// ─── Constants ────────────────────────────────────────────────────────────────

const WEB_STREAM_GLOBALS = [
  'ReadableStream',
  'WritableStream',
  'TransformStream',
  'TextDecoderStream',
  'TextEncoderStream',
];

// ─── Jest Node Environment ────────────────────────────────────────────────────

/**
 * Custom Jest node environment that forwards modern Node.js globals
 * (fetch, crypto, Web Streams, TextEncoder/Decoder, etc.)
 * into the test VM sandbox — these are absent from Jest's built-in
 * jest-environment-node due to its strict VM context isolation.
 */
class XnapifyNodeEnvironment extends NodeEnvironment {
  async setup() {
    await super.setup();

    this.#forwardGlobals();
    await this.#forwardWebStreams();
    await this.#forwardTextCodecs();
    this.#injectRequireContext();
  }

  /** Forward Node 16+/18+ globals missing from Jest's VM context. */
  #forwardGlobals() {
    const globalsToForward = [
      'AbortController',
      'AbortSignal',
      'fetch',
      'Headers',
      'Request',
      'Response',
      'FormData',
      'crypto',
      'structuredClone',
      'EventTarget',
      'Event',
      'MessageChannel',
      'MessagePort',
      'BroadcastChannel',
      'performance',
      'PerformanceObserver',
    ];

    for (const name of globalsToForward) {
      if (typeof globalThis[name] !== 'undefined') {
        this.global[name] = globalThis[name];
      }
    }
  }

  /** Forward Web Streams API. */
  async #forwardWebStreams() {
    for (const name of WEB_STREAM_GLOBALS) {
      // First try to grab from globalThis (Node 18+)
      if (typeof globalThis[name] !== 'undefined') {
        this.global[name] = globalThis[name];
      }
    }

    // Fallback to stream/web for older Node or missing streams
    if (!this.global.ReadableStream) {
      try {
        const webStreams = await import('stream/web');
        for (const name of WEB_STREAM_GLOBALS) {
          if (webStreams[name]) this.global[name] = webStreams[name];
        }
      } catch (_e) {
        // stream/web not available — skip
      }
    }
  }

  /** Forward TextEncoder / TextDecoder. */
  async #forwardTextCodecs() {
    if (typeof globalThis.TextEncoder !== 'undefined') {
      this.global.TextEncoder = globalThis.TextEncoder;
      this.global.TextDecoder = globalThis.TextDecoder;
      return;
    }

    try {
      const util = await import('util');
      if (util.TextEncoder) this.global.TextEncoder = util.TextEncoder;
      if (util.TextDecoder) this.global.TextDecoder = util.TextDecoder;
    } catch (_e) {
      // util not available — skip
    }
  }

  /**
   * Inject require.context into the VM sandbox's global require object.
   * This covers code that accesses require.context via the global object
   * rather than the module-local require function.
   */
  #injectRequireContext() {
    this.global.require = this.global.require || {};
    this.global.require.context = requireContext;
  }
}

export default XnapifyNodeEnvironment;
