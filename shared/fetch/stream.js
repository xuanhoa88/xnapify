/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// ========================================================================
// Web Streams resolution (isomorphic — browser globals / Node 16 stream/web)
// ========================================================================

/* eslint-disable no-underscore-dangle */
let _TransformStream = globalThis.TransformStream;
let _TextDecoderStream = globalThis.TextDecoderStream;

// Node 16 does not expose Web Streams as globals.
// Use dynamic require to avoid webpack bundling stream/web for the client.
if (!_TransformStream || !_TextDecoderStream) {
  try {
    // eslint-disable-next-line global-require, no-eval
    const webStreams = eval("require('stream/web')");
    if (!_TransformStream) _TransformStream = webStreams.TransformStream;
    if (!_TextDecoderStream) _TextDecoderStream = webStreams.TextDecoderStream;
  } catch (_e) {
    // Browser environment — globals must already exist
  }
}
/* eslint-enable no-underscore-dangle */

// ========================================================================
// Constants
// ========================================================================

const DEFAULT_RETRY_INTERVAL = 1000;
const DEFAULT_MAX_RETRIES = 3;

// ========================================================================
// TextLineStream (inlined — equivalent to Deno's @std/streams/text-line-stream)
// ========================================================================

/**
 * TransformStream that splits text chunks into individual lines.
 * Handles \n, \r\n, and \r line endings.
 */
class TextLineStream extends _TransformStream {
  constructor() {
    let buffer = '';

    super({
      transform(chunk, controller) {
        buffer += chunk;
        const lines = buffer.split(/\r?\n|\r/);
        buffer = lines.pop() || '';
        for (let i = 0; i < lines.length; i++) {
          controller.enqueue(lines[i]);
        }
      },

      flush(controller) {
        if (buffer) {
          controller.enqueue(buffer);
          buffer = '';
        }
      },
    });
  }
}

// ========================================================================
// SSE Field Parser
// ========================================================================

const FIELD_RE = /[:][\s]*/;

/**
 * Parse a single SSE field line into [field, value].
 * Returns undefined for comment lines (starting with ":") or invalid lines.
 *
 * @param {string} line
 * @returns {string[]|undefined}
 */
function parseField(line) {
  const match = FIELD_RE.exec(line);
  const idx = match && match.index;

  // idx === 0 means the line starts with ":" — SSE comment, skip
  // idx === null/undefined means no ":" found — skip
  if (!idx) {
    return undefined;
  }

  return [line.substring(0, idx), line.substring(idx + match[0].length)];
}

// ========================================================================
// Core SSE Stream Parser
// ========================================================================

/**
 * Convert a ReadableStream<Uint8Array> containing Server-Sent Events (SSE)
 * into an AsyncGenerator that yields SSE message objects.
 *
 * SSE Message shape:
 * {
 *   event: string,    // Event type (e.g. "message")
 *   data: string,     // Event payload (multi-line joined by \n)
 *   id: number|string, // Last event ID
 *   retry: number     // Reconnection interval hint (ms)
 * }
 *
 * @param {ReadableStream<Uint8Array>} body
 * @param {AbortSignal} [signal]
 * @returns {AsyncGenerator<Object, void, unknown>}
 */
export async function* parseSSEStream(body, signal) {
  if (!body) return;

  const decoded = body
    .pipeThrough(new _TextDecoderStream())
    .pipeThrough(new TextLineStream());

  const reader = decoded.getReader();
  let event;

  try {
    for (;;) {
      if (signal && signal.aborted) {
        await reader.cancel();
        return;
      }

      const line = await reader.read();
      if (line.done) return;

      // Empty line = event delimiter per SSE spec
      if (!line.value) {
        if (event) yield event;
        event = undefined;
        continue;
      }

      const parsed = parseField(line.value);
      if (!parsed) continue;

      const field = parsed[0];
      const value = parsed[1];

      if (field === 'data') {
        if (!event) event = {};
        // SSE spec: multi-line data concatenated with \n
        event.data = event.data ? event.data + '\n' + value : value;
      } else if (field === 'event') {
        if (!event) event = {};
        event.event = value;
      } else if (field === 'id') {
        if (!event) event = {};
        event.id = String(+value) === value ? +value : value;
      } else if (field === 'retry') {
        if (!event) event = {};
        event.retry = +value || undefined;
      }
    }
  } finally {
    // Ensure reader is released even on break/throw
    try {
      reader.releaseLock();
    } catch (_e) {
      // Reader may already be released
    }
  }
}

// ========================================================================
// Auto-Reconnecting SSE Stream
// ========================================================================

/**
 * Creates an auto-reconnecting SSE stream.
 *
 * Tracks the `retry` (reconnection delay) and `id` (Last-Event-ID) fields
 * from the SSE protocol. On mid-stream network error:
 *   1. Waits `retry` ms (default 1000ms)
 *   2. Re-fetches with `Last-Event-ID` header
 *   3. Resumes yielding events
 *
 * Stops reconnecting on AbortSignal abort or maxRetries exhaustion.
 *
 * @param {Function} fetchFn - The $factory function from createFetch
 * @param {string} request - URL to fetch
 * @param {Object} options - Fetch options + SSE-specific options
 * @param {number} [options.maxRetries=3] - Max reconnection attempts
 * @param {number} [options.retryInterval=1000] - Default reconnect delay (ms)
 * @returns {AsyncGenerator<Object, void, unknown>}
 */
export async function* createSSEStream(fetchFn, request, options) {
  const {
    maxRetries: maxRetriesOpt,
    retryInterval: retryIntervalOpt,
    signal,
    ...restOptions
  } = options || {};

  const maxRetries =
    typeof maxRetriesOpt === 'number' ? maxRetriesOpt : DEFAULT_MAX_RETRIES;
  const defaultRetryInterval =
    typeof retryIntervalOpt === 'number'
      ? retryIntervalOpt
      : DEFAULT_RETRY_INTERVAL;

  // Preserve clean fetch options without SSE-specific fields
  const fetchOptions = restOptions;

  let lastEventId;
  let retryInterval = defaultRetryInterval;
  let retries = 0;

  while (retries <= maxRetries) {
    if (signal && signal.aborted) return;

    // Inject Last-Event-ID header for reconnections
    const headers = Object.assign({}, fetchOptions.headers);
    if (lastEventId != null) {
      headers['last-event-id'] = String(lastEventId);
    }

    let response;
    try {
      response = await fetchFn(
        request,
        Object.assign({}, fetchOptions, { headers }),
      );
    } catch (error) {
      // Initial connection failure — let it propagate on first attempt
      // or if retries exhausted
      if (retries >= maxRetries) throw error;

      retries++;
      await new Promise(function (resolve) {
        return setTimeout(resolve, retryInterval);
      });
      continue;
    }

    // Reset retry counter on successful connection
    retries = 0;

    // eslint-disable-next-line no-underscore-dangle
    const body = response._data || response.body;
    if (!body) {
      throw new TypeError('Response body is null — cannot stream SSE');
    }

    try {
      const stream = parseSSEStream(body, signal);

      for (;;) {
        const result = await stream.next();
        if (result.done) return;

        const event = result.value;

        // Track protocol fields for reconnection
        if (event.id != null) {
          lastEventId = event.id;
        }
        if (event.retry != null) {
          retryInterval = event.retry;
        }

        yield event;
      }
    } catch (error) {
      // Mid-stream disconnect
      if (signal && signal.aborted) return;

      // Check if this is an abort error — don't retry
      if (error && error.name === 'AbortError') return;

      retries++;
      if (retries > maxRetries) throw error;

      // Wait before reconnecting
      await new Promise(function (resolve) {
        return setTimeout(resolve, retryInterval);
      });
    }
  }
}
