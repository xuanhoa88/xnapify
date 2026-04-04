/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Custom Jest node environment that forwards modern Node.js globals
 * (AbortController, AbortSignal, etc.) into the test sandbox.
 *
 * Jest 24's default jest-environment-node was written before these
 * globals existed in Node 16+, so they're missing from the vm context.
 */

const NodeEnvironment = require('jest-environment-node');

class XnapifyNodeEnvironment extends NodeEnvironment {
  async setup() {
    await super.setup();

    // Forward Node 16+ globals that Jest 24 doesn't know about
    if (typeof AbortController !== 'undefined') {
      this.global.AbortController = AbortController;
    }
    if (typeof AbortSignal !== 'undefined') {
      this.global.AbortSignal = AbortSignal;
    }

    // Forward Web Streams APIs (Node 16+ via stream/web)
    try {
      const webStreams = require('stream/web');
      const streamGlobals = [
        'ReadableStream',
        'WritableStream',
        'TransformStream',
        'TextDecoderStream',
        'TextEncoderStream',
      ];
      for (let i = 0; i < streamGlobals.length; i++) {
        const name = streamGlobals[i];
        if (webStreams[name]) {
          this.global[name] = webStreams[name];
        }
      }
    } catch (_e) {
      // stream/web not available — skip
    }

    // Forward TextEncoder / TextDecoder (Node 12+ via util)
    try {
      const util = require('util');
      if (util.TextEncoder) {
        this.global.TextEncoder = util.TextEncoder;
      }
      if (util.TextDecoder) {
        this.global.TextDecoder = util.TextDecoder;
      }
    } catch (_e) {
      // util not available — skip
    }
  }
}

module.exports = XnapifyNodeEnvironment;
