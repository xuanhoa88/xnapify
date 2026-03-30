/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// Payload methods
const payloadMethods = new Set(
  Object.freeze(['PATCH', 'POST', 'PUT', 'DELETE']),
);

// Text types
const textTypes = new Set([
  'image/svg',
  'image/svg+xml',
  'application/xml',
  'application/xhtml',
  'application/xhtml+xml',
  'application/html',
]);

// JSON regex
const JSON_RE = /^application\/(?:[\w!#$%&*.^`~-]*\+)?json(;.+)?$/i;

/**
 * Check if the given method is a payload method
 *
 * @param {string} method
 * @returns {boolean}
 */
export function isPayloadMethod(method = 'GET') {
  return payloadMethods.has(method.toUpperCase());
}

/**
 * Check if the given value is JSON serializable
 *
 * @param {*} value
 * @returns {boolean}
 */
export function isJSONSerializable(value) {
  if (value === undefined) {
    return false;
  }

  const t = typeof value;

  if (t === 'string' || t === 'number' || t === 'boolean' || value === null) {
    return true;
  }

  if (t !== 'object') {
    return false; // bigint, function, symbol
  }

  if (Array.isArray(value)) {
    return true;
  }

  // Binary data
  if (value.buffer || value instanceof ArrayBuffer) {
    return false;
  }

  // Web APIs that shouldn't be JSON-serialized (with existence checks for Node.js)
  if (
    (typeof FormData !== 'undefined' && value instanceof FormData) ||
    (typeof URLSearchParams !== 'undefined' &&
      value instanceof URLSearchParams) ||
    (typeof Blob !== 'undefined' && value instanceof Blob) ||
    (typeof File !== 'undefined' && value instanceof File)
  ) {
    return false;
  }

  // Date is JSON-serializable (has toJSON)
  if (value instanceof Date) {
    return true;
  }

  // Plain objects or objects with toJSON method
  return (
    Object.prototype.toString.call(value) === '[object Object]' ||
    typeof value.toJSON === 'function'
  );
}

// Reasonable defaults based on Content-Type
export function detectResponseType(_contentType = '') {
  if (!_contentType) {
    return 'json';
  }

  // e.g. "application/json; charset=utf-8"
  const contentType = _contentType.split(';').shift() || '';

  if (JSON_RE.test(contentType)) {
    return 'json';
  }

  // SSE
  if (contentType === 'text/event-stream') {
    return 'stream';
  }

  if (textTypes.has(contentType) || contentType.startsWith('text/')) {
    return 'text';
  }

  return 'blob';
}

/**
 * Resolves the given fetch options
 *
 * @param {Request} request
 * @param {Object} input
 * @param {Object} defaults
 * @returns {Object}
 */
export function resolveFetchOptions(request, input, defaults) {
  // Merge headers (as plain object)
  const headers = mergeHeaders(
    input && input.headers ? input.headers : request && request.headers,
    defaults && defaults.headers,
  );

  // Merge query / params
  let query;
  if (
    (defaults && (defaults.query || defaults.params)) ||
    (input && (input.query || input.params))
  ) {
    query = {
      ...(defaults && defaults.params),
      ...(defaults && defaults.query),
      ...(input && input.params),
      ...(input && input.query),
    };
  }

  return {
    ...defaults,
    ...input,
    query,
    params: query,
    headers,
  };
}

/**
 * Merges the given headers into a plain object
 *
 * @param {Object|Headers|Array} input
 * @param {Object|Headers|Array} defaults
 * @returns {Object}
 */
function mergeHeaders(input, defaults) {
  const result = {};

  // Helper to add headers from various formats
  const addHeaders = source => {
    if (!source) return;

    // Handle Headers instance (has entries method)
    if (typeof source.entries === 'function') {
      for (const [key, value] of source.entries()) {
        result[key.toLowerCase()] = value;
      }
    }
    // Handle array of [key, value] pairs
    else if (Array.isArray(source)) {
      for (const [key, value] of source) {
        result[key.toLowerCase()] = value;
      }
    }
    // Handle plain object
    else if (typeof source === 'object') {
      for (const [key, value] of Object.entries(source)) {
        if (value !== undefined) {
          result[key.toLowerCase()] = value;
        }
      }
    }
  };

  // Add defaults first, then input (input overrides defaults)
  addHeaders(defaults);
  addHeaders(input);

  return result;
}

/**
 * Calls the given hooks
 *
 * @param {Object} context
 * @param {Function|Array<Function>} hooks
 * @returns {Promise<void>}
 */
export async function callHooks(context, hooks) {
  if (!hooks) return;

  if (Array.isArray(hooks)) {
    for (const hook of hooks) {
      if (typeof hook === 'function') {
        await hook(context);
      }
    }
  } else if (typeof hooks === 'function') {
    await hooks(context);
  }
}

/**
 * Joins the given base URL and path, ensuring that there is only one slash between them.
 *
 * @param {string} base
 * @param {string} path
 * @returns {string}
 */
function joinURL(base, path) {
  // eslint-disable-next-line no-underscore-dangle
  const _base = typeof base === 'string' ? base.trim() : '';

  // eslint-disable-next-line no-underscore-dangle
  const _path = typeof path === 'string' ? path.trim() : '';

  if (!_base || _base === '/') {
    return _path || '/';
  }

  if (!_path || _path === '/') {
    return _base || '/';
  }

  const baseHasTrailing = _base[_base.length - 1] === '/';
  const pathHasLeading = _path[0] === '/';

  if (baseHasTrailing && pathHasLeading) {
    return _base + _path.slice(1);
  }

  if (!baseHasTrailing && !pathHasLeading) {
    return `${_base}/${_path}`;
  }

  return _base + _path;
}

/**
 * Adds the base path to the input path, if it is not already present.
 *
 * @param {string} input
 * @param {string} base
 * @returns {string}
 */
export function withBase(input = '', base = '') {
  // eslint-disable-next-line no-underscore-dangle
  const _input = typeof input === 'string' ? input.trim() : '';
  // eslint-disable-next-line no-underscore-dangle
  const _base = typeof base === 'string' ? base.trim() : '';

  if (!_base || _base === '/') {
    return _input;
  }

  const baseNormalized = withoutTrailingSlash(_base);
  if (_input.startsWith(baseNormalized)) {
    return _input;
  }

  return joinURL(baseNormalized, _input);
}

/**
 * Removes the trailing slash from the given path.
 *
 * @param {string} path
 * @returns {string}
 */
function withoutTrailingSlash(path) {
  // eslint-disable-next-line no-underscore-dangle
  const _path = typeof path === 'string' ? path.trim() : '';
  if (!_path || _path === '/') {
    return '/';
  }
  return _path[_path.length - 1] === '/' ? _path.slice(0, -1) : _path;
}

/**
 * Returns the URL with the given query parameters.
 * Undefined values are omitted.
 *
 * @param {string} input
 * @param {Object} query
 * @returns {string}
 */
export function withQuery(input, query) {
  // eslint-disable-next-line no-underscore-dangle
  const _input = typeof input === 'string' ? input.trim() : '';

  if (!query || typeof query !== 'object' || Object.keys(query).length === 0) {
    return _input;
  }

  const searchIndex = _input.indexOf('?');

  // No existing query string
  if (searchIndex === -1) {
    const normalizedQuery = Object.entries(query)
      .filter(([, value]) => value !== undefined)
      .flatMap(([key, value]) => {
        if (Array.isArray(value)) {
          return value
            .filter(item => item !== undefined)
            .map(item => [key, normalizeQueryValue(item)]);
        }
        return [[key, normalizeQueryValue(value)]];
      });

    const searchParams = new URLSearchParams(normalizedQuery);
    const queryString = searchParams.toString();

    return queryString ? `${_input}?${queryString}` : _input;
  }

  // Existing query string - merge with new params
  const base = _input.slice(0, searchIndex);
  const searchParams = new URLSearchParams(_input.slice(searchIndex + 1));

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) {
      searchParams.delete(key);
    } else if (Array.isArray(value)) {
      searchParams.delete(key); // Clear existing before appending
      for (const item of value) {
        if (item !== undefined) {
          searchParams.append(key, normalizeQueryValue(item));
        }
      }
    } else {
      searchParams.set(key, normalizeQueryValue(value));
    }
  }

  const queryString = searchParams.toString();
  return queryString ? `${base}?${queryString}` : base;
}

/**
 * Normalizes the given query value.
 *
 * @param {*} value
 * @returns {string}
 */
function normalizeQueryValue(value) {
  if (value == null) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}
