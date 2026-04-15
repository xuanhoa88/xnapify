/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

'use strict';

const Module = require('module');

const NodeEnvironment = require('jest-environment-node');

const requireContext = require('./requireContextPolyfill');

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
 * (AbortController, AbortSignal, Web Streams, TextEncoder/Decoder, etc.)
 * into the test VM sandbox — these are absent from Jest 24's built-in
 * jest-environment-node, which predates Node 16+.
 */
class XnapifyNodeEnvironment extends NodeEnvironment {
  async setup() {
    await super.setup();

    // eslint-disable-next-line no-underscore-dangle
    this._forwardGlobals();
    // eslint-disable-next-line no-underscore-dangle
    this._forwardWebStreams();
    // eslint-disable-next-line no-underscore-dangle
    this._forwardTextCodecs();
    // eslint-disable-next-line no-underscore-dangle
    this._injectRequireContext();
  }

  /** Forward Node 16+ globals missing from Jest 24's VM context. */
  _forwardGlobals() {
    for (const name of ['AbortController', 'AbortSignal']) {
      if (typeof globalThis[name] !== 'undefined') {
        this.global[name] = globalThis[name];
      }
    }
  }

  /** Forward Web Streams API (Node 16+ via stream/web). */
  _forwardWebStreams() {
    try {
      const webStreams = require('stream/web');
      for (const name of WEB_STREAM_GLOBALS) {
        if (webStreams[name]) this.global[name] = webStreams[name];
      }
    } catch (_e) {
      // stream/web not available — skip
    }
  }

  /** Forward TextEncoder / TextDecoder (Node 12+ via util). */
  _forwardTextCodecs() {
    try {
      const util = require('util');
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
  _injectRequireContext() {
    this.global.require = this.global.require || {};
    this.global.require.context = requireContext;
  }
}

module.exports = XnapifyNodeEnvironment;
