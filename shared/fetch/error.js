/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Custom error class for fetch-related errors
 * Provides detailed context about failed HTTP requests
 */
export class FetchError extends Error {
  /**
   * @param {string} message - Error message
   * @param {number} status - HTTP status code
   * @param {string} statusText - HTTP status text
   * @param {string} url - Request URL
   * @param {*} data - Response data (if available)
   * @param {Error|null} cause - Original error that caused this error
   */
  constructor(message, status, statusText, url, data = null, cause = null) {
    super(message);

    this.name = 'FetchError';
    this.status = status;
    this.statusText = statusText;
    this.url = url;
    this.data = data;
    this.cause = cause;

    // Capture stack trace for better debugging (Node.js)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, FetchError);
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
      url: this.url,
      data: this.data,
      cause: this.cause ? String(this.cause) : undefined,
    };
  }

  /**
   * String representation of the error
   * Useful for console.log() across all environments
   *
   * @returns {string}
   */
  toString() {
    return `${this.name}: ${this.message} [${this.status}]`;
  }
}

/**
 * Safely extracts URL from various request formats
 * Handles: string, object with url property, Request object, URL object
 *
 * @param {*} request - Request in various formats
 * @returns {string}
 */
function extractUrl(request) {
  if (!request) {
    return '/';
  }

  // String URL
  if (typeof request === 'string') {
    return request;
  }

  // Request object (browser/worker Fetch API)
  if (typeof request === 'object') {
    // Check for url property first (most common)
    if (request.url) {
      return request.url;
    }

    // Check if it's a URL object
    if (request.href) {
      return request.href;
    }

    // Try to stringify if it has a toString method
    if (typeof request.toString === 'function') {
      const str = request.toString();
      // Avoid '[object Object]' strings
      if (str !== '[object Object]') {
        return str;
      }
    }
  }

  return '/';
}

/**
 * Creates a FetchError from a fetch context object
 *
 * Expected ctx structure:
 * {
 *   request: Request | { url: string, method?: string } | string,
 *   options: { method?: string },
 *   response: { status: number, statusText: string, _data?: any } | null,
 *   error: Error | null
 * }
 *
 * Lazy getters are used to always reflect current ctx values, which is useful
 * when the context is mutated after error creation (e.g., retry logic, middleware)
 *
 * @param {Object} ctx - Fetch context object
 * @returns {FetchError}
 */
export function createFetchError(ctx) {
  // Extract request method
  const method =
    (ctx.request && ctx.request.method) ||
    (ctx.options && ctx.options.method) ||
    'GET';

  // Extract request URL using helper
  const url = extractUrl(ctx.request);

  // Format response status
  const statusStr = ctx.response
    ? `${ctx.response.status || 0} ${ctx.response.statusText || 'Unknown'}`
    : '<no response>';

  // Determine error message priority:
  // 1. Explicit error message
  // 2. Response data error/message
  // 3. Fallback to formatted request info
  let errorMessage = `[${method}] ${url}: ${statusStr}`;

  if (ctx.error && ctx.error.message) {
    errorMessage = ctx.error.message;
    // eslint-disable-next-line no-underscore-dangle
  } else if (ctx.response && ctx.response._data) {
    // eslint-disable-next-line no-underscore-dangle
    const responseData = ctx.response._data;
    if (responseData.message || responseData.error) {
      errorMessage = responseData.message || responseData.error;
    }
  }

  // Create error with safe property access
  const fetchError = new FetchError(
    errorMessage,
    (ctx.response && ctx.response.status) || 0,
    (ctx.response && ctx.response.statusText) || 'Unknown',
    url,
    // eslint-disable-next-line no-underscore-dangle
    ctx.response && ctx.response._data,
    ctx.error,
  );

  // Add lazy getters for context objects
  // These always reflect current ctx values (useful for middleware/retry logic)
  // Using try-catch to ensure compatibility across environments
  try {
    for (const key of ['request', 'options', 'response']) {
      Object.defineProperty(fetchError, key, {
        enumerable: true,
        configurable: true,
        get() {
          return ctx[key];
        },
      });
    }

    // Add lazy getters for response properties with aliases
    // Aliases provide compatibility with different naming conventions:
    // - data/_data: Internal vs public response data
    // - status/statusCode: Different API conventions
    // - statusText/statusMessage: HTTP vs common terminology
    for (const [key, refKey] of [
      ['data', '_data'],
      ['status', 'status'],
      ['statusCode', 'status'],
      ['statusText', 'statusText'],
      ['statusMessage', 'statusText'],
    ]) {
      Object.defineProperty(fetchError, key, {
        enumerable: true,
        configurable: true,
        get() {
          return ctx.response && ctx.response[refKey];
        },
      });
    }
  } catch (error) {
    // In rare cases where Object.defineProperty fails (frozen objects, etc.)
    // fallback to direct assignment
    fetchError.request = ctx.request;
    fetchError.options = ctx.options;
    fetchError.response = ctx.response;
  }

  return fetchError;
}

/**
 * Type guard to check if an error is a FetchError
 * Useful for error handling across different environments
 *
 * @param {*} error - Error to check
 * @returns {boolean}
 */
export function isFetchError(error) {
  return error instanceof FetchError || (error && error.name === 'FetchError');
}
