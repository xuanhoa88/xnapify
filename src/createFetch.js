/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Custom error class for fetch-related errors with enhanced context
 */
export class FetchError extends Error {
  /**
   * @param {string} message - Error message
   * @param {number} status - HTTP status code
   * @param {string} statusText - HTTP status text
   * @param {string} url - Request URL
   * @param {any} data - Response data if available
   */
  constructor(message, status, statusText, url, data = null) {
    super(message);
    this.name = 'FetchError';
    this.status = status;
    this.statusText = statusText;
    this.url = url;
    this.data = data;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Configuration options for createFetch
 *
 * @typedef {Object} FetchConfig
 * @property {string} [baseUrl] - Base URL for relative paths
 * @property {Object} [headers] - Default headers
 * @property {Function} [onRequest] - Request interceptor
 * @property {Function} [onResponse] - Response interceptor
 * @property {Function} [onError] - Error interceptor
 */

/**
 * Creates a simple wrapper around the Fetch API for server/client compatibility.
 *
 * @param {Function} fetch - Native fetch function or polyfill
 * @param {FetchConfig} config - Configuration options
 * @returns {Function} Enhanced fetch function that returns parsed data or throws FetchError
 */
export function createFetch(fetch, config = {}) {
  const {
    baseUrl = '',
    onRequest = null,
    onResponse = null,
    onError = null,
    headers = {},
  } = config || {};

  // Default fetch options for internal API requests
  const defaults = {
    method: 'GET',
    mode: 'same-origin',
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  /**
   * Merges multiple AbortSignals into one
   * @param {AbortSignal[]} signals - Array of signals to merge
   * @returns {AbortSignal} Merged signal
   */
  const mergeSignals = (...signals) => {
    const controller = new AbortController();

    for (const signal of signals) {
      if (signal) {
        if (signal.aborted) {
          controller.abort();
          break;
        }
        signal.addEventListener('abort', () => controller.abort(), {
          once: true,
        });
      }
    }

    return controller.signal;
  };

  /**
   * Execute fetch with optional timeout using AbortController
   * @param {string} url - Request URL
   * @param {Object} options - Fetch options
   * @returns {Promise<Response>} Fetch response
   */
  const executeRequest = async (url, options) => {
    const { timeout, signal: userSignal, ...fetchOptions } = options;

    // No timeout specified or AbortController not available, use regular fetch
    if (!timeout || typeof AbortController === 'undefined') {
      return fetch(url, options);
    }

    // Use AbortController for proper cancellation
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      // Merge timeout signal with user-provided signal if exists
      const signal = userSignal
        ? mergeSignals(controller.signal, userSignal)
        : controller.signal;

      const response = await fetch(url, {
        ...fetchOptions,
        signal,
      });

      return response;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new FetchError(
          `Request timeout after ${timeout}ms`,
          408,
          'Request Timeout',
          url,
        );
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  };

  /**
   * Process response and handle errors
   * @param {Response} response - Fetch response
   * @param {string} url - Request URL
   * @returns {Promise<any>} Parsed response data
   */
  const processResponse = async (response, url) => {
    // Handle redirect responses
    if (response.type === 'opaqueredirect') {
      return {
        redirected: true,
        status: response.status,
        location: response.headers.get('Location'),
      };
    }

    // Handle empty responses (204 No Content or empty body)
    const contentLength = response.headers.get('content-length');
    if (response.status === 204 || contentLength === '0') {
      if (!response.ok) {
        throw new FetchError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          response.statusText,
          url,
          null,
        );
      }
      return null;
    }

    // Parse response body
    let data = null;
    try {
      const contentType = response.headers.get('content-type');
      const isJson = contentType && contentType.includes('application/json');
      data = isJson ? await response.json() : await response.text();
    } catch (error) {
      throw new FetchError(
        'Failed to parse response body',
        response.status,
        response.statusText,
        url,
        null,
      );
    }

    // Check for HTTP errors
    if (!response.ok) {
      throw new FetchError(
        (data && data.message) ||
          `HTTP ${response.status}: ${response.statusText}`,
        response.status,
        response.statusText,
        url,
        data,
      );
    }

    return data;
  };

  /**
   * Enhanced fetch function with interceptors and error handling
   * @param {string} url - Request URL (absolute or relative)
   * @param {Object} options - Fetch options
   * @returns {Promise<any>} Parsed response data
   */
  return async function enhancedFetch(url, options = {}) {
    try {
      // Auto-detect: absolute URL (http/https) or relative path
      const isAbsoluteUrl = /^https?:\/\//i.test(url);

      // Construct full URL for relative paths
      const fullUrl = isAbsoluteUrl ? url : `${baseUrl}${url}`;

      // Apply defaults only for relative paths (internal API)
      let mergedOptions = !isAbsoluteUrl
        ? {
            ...defaults,
            ...options,
            headers: {
              ...defaults.headers,
              ...(options.headers || {}),
            },
          }
        : {
            ...options,
            headers: {
              ...(options.headers || {}),
            },
          };

      // Apply request interceptor
      if (typeof onRequest === 'function') {
        const interceptedOptions = await onRequest(fullUrl, mergedOptions);
        // Allow interceptor to modify or replace options
        mergedOptions = interceptedOptions || mergedOptions;
      }

      // Execute request (with optional timeout from options)
      const response = await executeRequest(fullUrl, mergedOptions);
      const data = await processResponse(response, fullUrl);

      // Apply response interceptor
      return typeof onResponse === 'function'
        ? await onResponse(data, response)
        : data;
    } catch (error) {
      // Apply error interceptor
      if (typeof onError === 'function') {
        const result = await onError(error);
        // If error interceptor returns a value, use it; otherwise rethrow
        if (result !== undefined) {
          return result;
        }
      }
      throw error;
    }
  };
}
