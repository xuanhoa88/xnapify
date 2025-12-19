/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createFetchError } from './error';
import {
  isPayloadMethod,
  isJSONSerializable,
  detectResponseType,
  resolveFetchOptions,
  callHooks,
  withBase,
  withQuery,
} from './utils';

// https://developer.mozilla.org/en-US/docs/Web/HTTP/Status
const retryStatusCodes = new Set([
  408, // Request Timeout
  409, // Conflict
  425, // Too Early (Experimental)
  429, // Too Many Requests
  500, // Internal Server Error
  502, // Bad Gateway
  503, // Service Unavailable
  504, // Gateway Timeout
]);

// https://developer.mozilla.org/en-US/docs/Web/API/Response/body
const nullBodyResponses = new Set([101, 204, 205, 304]);

/**
 * Creates a timeout signal (polyfill for AbortSignal.timeout)
 *
 * @param {number} ms
 * @returns {AbortSignal}
 */
function createTimeoutSignal(ms) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(
      new DOMException(
        'The operation was aborted due to timeout',
        'TimeoutError',
      ),
    );
  }, ms);

  // Clean up timeout if signal is aborted externally
  controller.signal.addEventListener('abort', () => clearTimeout(timeoutId), {
    once: true,
  });

  return controller.signal;
}

/**
 * Merges multiple abort signals (polyfill for AbortSignal.any)
 *
 * @param {AbortSignal[]} signals
 * @returns {AbortSignal}
 */
function mergeAbortSignals(signals) {
  // Use native AbortSignal.any if available
  if (typeof AbortSignal.any === 'function') {
    return AbortSignal.any(signals);
  }

  const controller = new AbortController();

  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      return controller.signal;
    }
    signal.addEventListener('abort', () => controller.abort(signal.reason), {
      once: true,
    });
  }

  return controller.signal;
}

/**
 * Creates a fetch function
 *
 * @param {Function} fetch
 * @param {Object} globalOptions
 * @returns {Function}
 */
export function createFetch(fetch, globalOptions = {}) {
  // Validate fetch function
  if (typeof fetch !== 'function') {
    throw new TypeError(
      'createFetch requires a fetch function as the first argument',
    );
  }

  // Error handler
  const onError = async function (context) {
    // Abort detection
    const isAbort =
      (context.error &&
        context.error.name === 'AbortError' &&
        !context.options.timeout) ||
      false;

    // Retry logic
    if (context.options.retry !== false && !isAbort) {
      let retries;
      if (typeof context.options.retry === 'number') {
        retries = context.options.retry;
      } else {
        retries = isPayloadMethod(context.options.method) ? 0 : 1;
      }

      const responseCode = (context.response && context.response.status) || 500;

      if (
        retries > 0 &&
        (Array.isArray(context.options.retryStatusCodes)
          ? context.options.retryStatusCodes.includes(responseCode)
          : retryStatusCodes.has(responseCode))
      ) {
        const retryDelay =
          typeof context.options.retryDelay === 'function'
            ? context.options.retryDelay(context)
            : context.options.retryDelay || 0;

        if (retryDelay > 0) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }

        return $factory(context.request, {
          ...context.options,
          retry: retries - 1,
        });
      }
    }

    // Normalize error
    const error = createFetchError(context);

    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(error, $factory);
    }

    throw error;
  };

  // Fetch factory
  const $factory = async function $factory(_request, _options = {}) {
    const context = {
      request: _request,
      options: resolveFetchOptions(_request, _options, globalOptions.defaults),
      response: undefined,
      error: undefined,
    };

    // Uppercase method
    if (context.options.method) {
      context.options.method = context.options.method.toUpperCase();
    }

    if (context.options.onRequest) {
      await callHooks(context, context.options.onRequest);
    }

    if (typeof context.request === 'string') {
      if (context.options.baseUrl) {
        context.request = withBase(context.request, context.options.baseUrl);
      }

      if (context.options.query) {
        context.request = withQuery(context.request, context.options.query);
        delete context.options.query;
      }

      if ('query' in context.options) delete context.options.query;
      if ('params' in context.options) delete context.options.params;
    }

    if (context.options.body && isPayloadMethod(context.options.method)) {
      if (isJSONSerializable(context.options.body)) {
        // Headers are now plain objects with lowercase keys
        const contentType = context.options.headers['content-type'];

        if (typeof context.options.body !== 'string') {
          context.options.body =
            contentType === 'application/x-www-form-urlencoded'
              ? new URLSearchParams(context.options.body).toString()
              : JSON.stringify(context.options.body);
        }

        // Set default headers (plain object)
        if (!contentType) {
          context.options.headers['content-type'] = 'application/json';
        }
        if (!context.options.headers.accept) {
          context.options.headers.accept = 'application/json';
        }
      } else if (
        // Web ReadableStream
        (context.options.body &&
          typeof context.options.body.pipeTo === 'function') ||
        // Node.js stream
        (context.options.body &&
          typeof context.options.body.pipe === 'function')
      ) {
        if (!('duplex' in context.options)) {
          context.options.duplex = 'half';
        }
      }
    }

    if (context.options.timeout) {
      const timeoutSignal =
        typeof AbortSignal.timeout === 'function'
          ? AbortSignal.timeout(context.options.timeout)
          : createTimeoutSignal(context.options.timeout);

      context.options.signal = context.options.signal
        ? mergeAbortSignals([timeoutSignal, context.options.signal])
        : timeoutSignal;
    }

    context.options.mode = context.options.baseUrl ? 'cors' : 'same-origin';
    context.options.credentials = context.options.baseUrl
      ? 'include'
      : 'same-origin';

    try {
      context.response = await fetch(context.request, context.options);
    } catch (error) {
      context.error = error;
      if (context.options.onRequestError) {
        await callHooks(context, context.options.onRequestError);
      }
      return onError(context);
    }

    const hasBody =
      // eslint-disable-next-line no-underscore-dangle
      (context.response.body || context.response._bodyInit) &&
      !nullBodyResponses.has(context.response.status) &&
      context.options.method !== 'HEAD';

    if (hasBody) {
      const responseType =
        context.options.responseType ||
        detectResponseType(context.response.headers.get('content-type') || '');

      switch (responseType) {
        case 'json': {
          if (typeof context.options.payloadParser === 'function') {
            const data = await context.response.text();
            // eslint-disable-next-line no-underscore-dangle
            context.response._data = context.options.payloadParser(data);
          } else {
            // eslint-disable-next-line no-underscore-dangle
            context.response._data = await context.response.json();
          }
          break;
        }
        case 'stream': {
          // eslint-disable-next-line no-underscore-dangle
          context.response._data =
            // eslint-disable-next-line no-underscore-dangle
            context.response.body || context.response._bodyInit;
          break;
        }
        default: {
          const validMethods = ['text', 'blob', 'arrayBuffer', 'formData'];
          const method = validMethods.includes(responseType)
            ? responseType
            : 'text';
          // eslint-disable-next-line no-underscore-dangle
          context.response._data = await context.response[method]();
          break;
        }
      }
    }

    if (context.options.onResponse) {
      await callHooks(context, context.options.onResponse);
    }

    if (
      !context.options.ignoreResponseError &&
      context.response.status >= 400 &&
      context.response.status < 600
    ) {
      if (context.options.onResponseError) {
        await callHooks(context, context.options.onResponseError);
      }
      return onError(context);
    }

    return context.response;
  };

  // Fetch function
  const $fetch = async function (request, options) {
    const r = await $factory(request, options);
    // eslint-disable-next-line no-underscore-dangle
    return r._data;
  };

  // Raw fetch
  $fetch.raw = $factory;

  // Native fetch
  $fetch.native = (...args) => fetch(...args);

  // Create new fetch instance
  $fetch.create = (defaultOptions = {}, customGlobalOptions = {}) =>
    createFetch(fetch, {
      ...globalOptions,
      ...customGlobalOptions,
      defaults: {
        ...globalOptions.defaults,
        ...customGlobalOptions.defaults,
        ...defaultOptions,
      },
    });

  return $fetch;
}
