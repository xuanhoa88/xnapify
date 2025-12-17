/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

export class FetchError extends Error {
  constructor(message, opts) {
    // Error cause support (Node 16.9+, modern browsers)
    super(message, opts);

    this.name = 'FetchError';

    // Polyfill `cause` for older runtimes
    if (opts && opts.cause && !this.cause) {
      this.cause = opts.cause;
    }
  }

  /**
   * Serializes the error for logging or JSON responses
   *
   * @returns {Object}
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      status: this.status,
      statusText: this.statusText,
      data: this.data,
      cause: this.cause ? String(this.cause) : undefined,
    };
  }
}

export function createFetchError(ctx) {
  const errorMessage =
    (ctx.error && ctx.error.message) ||
    (ctx.error && ctx.error.toString()) ||
    '';

  const method =
    (ctx.request && ctx.request.method) ||
    (ctx.options && ctx.options.method) ||
    'GET';

  const url = (ctx.request && ctx.request.url) || String(ctx.request) || '/';

  const requestStr = `[${method}] ${JSON.stringify(url)}`;

  const statusStr = ctx.response
    ? `${ctx.response.status} ${ctx.response.statusText}`
    : '<no response>';

  const message = `${requestStr}: ${statusStr}${
    errorMessage ? ` ${errorMessage}` : ''
  }`;

  const fetchError = new FetchError(
    message,
    ctx.error ? { cause: ctx.error } : undefined,
  );

  // Lazy getters → always reflect current ctx values
  for (const key of ['request', 'options', 'response']) {
    Object.defineProperty(fetchError, key, {
      enumerable: true,
      get() {
        return ctx[key];
      },
    });
  }

  for (const [key, refKey] of [
    ['data', '_data'],
    ['status', 'status'],
    ['statusCode', 'status'],
    ['statusText', 'statusText'],
    ['statusMessage', 'statusText'],
  ]) {
    Object.defineProperty(fetchError, key, {
      enumerable: true,
      get() {
        return ctx.response && ctx.response[refKey];
      },
    });
  }

  return fetchError;
}
