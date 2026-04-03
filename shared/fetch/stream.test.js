/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/* eslint-env jest */

import { parseSSEStream, createSSEStream } from './stream';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a ReadableStream<Uint8Array> from a string.
 * Optionally splits the string into multiple chunks to simulate real streaming.
 */
function createByteStream(text, chunkSize) {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);
  const size = chunkSize || bytes.length;

  return new ReadableStream({
    start(controller) {
      let offset = 0;
      while (offset < bytes.length) {
        controller.enqueue(bytes.slice(offset, offset + size));
        offset += size;
      }
      controller.close();
    },
  });
}

/**
 * Collect all events from an async generator into an array.
 */
async function collectEvents(generator) {
  const events = [];
  for await (const event of generator) {
    events.push(event);
  }
  return events;
}

// ---------------------------------------------------------------------------
// parseSSEStream
// ---------------------------------------------------------------------------

describe('[shared/fetch] stream.js', () => {
  describe('parseSSEStream', () => {
    it('parses a single SSE event', async () => {
      const body = createByteStream('data: hello\n\n');
      const events = await collectEvents(parseSSEStream(body));

      expect(events).toEqual([{ data: 'hello' }]);
    });

    it('parses multiple SSE events', async () => {
      const body = createByteStream(
        'data: first\n\ndata: second\n\nevent: done\ndata: third\n\n',
      );
      const events = await collectEvents(parseSSEStream(body));

      expect(events).toEqual([
        { data: 'first' },
        { data: 'second' },
        { event: 'done', data: 'third' },
      ]);
    });

    it('concatenates multi-line data fields with newline', async () => {
      const body = createByteStream(
        'data: line one\ndata: line two\ndata: line three\n\n',
      );
      const events = await collectEvents(parseSSEStream(body));

      expect(events).toEqual([{ data: 'line one\nline two\nline three' }]);
    });

    it('parses event, id, and retry fields', async () => {
      const body = createByteStream(
        'event: update\nid: 42\nretry: 5000\ndata: payload\n\n',
      );
      const events = await collectEvents(parseSSEStream(body));

      expect(events).toEqual([
        { event: 'update', id: 42, retry: 5000, data: 'payload' },
      ]);
    });

    it('treats numeric id as number', async () => {
      const body = createByteStream('id: 123\ndata: test\n\n');
      const events = await collectEvents(parseSSEStream(body));

      expect(events[0].id).toBe(123);
    });

    it('treats non-numeric id as string', async () => {
      const body = createByteStream('id: abc-def\ndata: test\n\n');
      const events = await collectEvents(parseSSEStream(body));

      expect(events[0].id).toBe('abc-def');
    });

    it('skips SSE comment lines', async () => {
      const body = createByteStream(': this is a comment\ndata: visible\n\n');
      const events = await collectEvents(parseSSEStream(body));

      expect(events).toEqual([{ data: 'visible' }]);
    });

    it('handles \\r\\n line endings', async () => {
      const body = createByteStream('data: crlf\r\n\r\n');
      const events = await collectEvents(parseSSEStream(body));

      expect(events).toEqual([{ data: 'crlf' }]);
    });

    it('handles chunked delivery across field boundaries', async () => {
      // Split into 5-byte chunks to test TextLineStream buffering
      const body = createByteStream('data: chunked\n\n', 5);
      const events = await collectEvents(parseSSEStream(body));

      expect(events).toEqual([{ data: 'chunked' }]);
    });

    it('returns empty for null body', async () => {
      const events = await collectEvents(parseSSEStream(null));
      expect(events).toEqual([]);
    });

    it('stops iteration when AbortSignal is aborted', async () => {
      const controller = new AbortController();
      let eventCount = 0;

      // Create a stream that yields continuously
      const body = new ReadableStream({
        start(ctrl) {
          ctrl.enqueue(new TextEncoder().encode('data: one\n\n'));
          ctrl.enqueue(new TextEncoder().encode('data: two\n\n'));
          ctrl.enqueue(new TextEncoder().encode('data: three\n\n'));
          ctrl.close();
        },
      });

      // eslint-disable-next-line no-underscore-dangle
      for await (const _evt of parseSSEStream(body, controller.signal)) {
        eventCount++;
        if (eventCount === 1) {
          controller.abort();
        }
      }

      expect(eventCount).toBe(1);
    });

    it('ignores invalid retry values', async () => {
      const body = createByteStream('retry: notanumber\ndata: test\n\n');
      const events = await collectEvents(parseSSEStream(body));

      expect(events[0].retry).toBeUndefined();
    });

    it('handles data field with empty value', async () => {
      const body = createByteStream('data: \n\n');
      const events = await collectEvents(parseSSEStream(body));

      expect(events).toEqual([{ data: '' }]);
    });
  });

  // ---------------------------------------------------------------------------
  // createSSEStream
  // ---------------------------------------------------------------------------

  describe('createSSEStream', () => {
    it('yields events from a successful fetch', async () => {
      const mockFetchFn = jest.fn().mockResolvedValue({
        body: createByteStream('data: hello\n\ndata: world\n\n'),
      });

      const events = await collectEvents(
        createSSEStream(mockFetchFn, '/events', {
          responseType: 'stream',
        }),
      );

      expect(events).toEqual([{ data: 'hello' }, { data: 'world' }]);
      expect(mockFetchFn).toHaveBeenCalledTimes(1);
    });

    it('uses _data from response when available', async () => {
      const mockFetchFn = jest.fn().mockResolvedValue({
        // eslint-disable-next-line no-underscore-dangle
        _data: createByteStream('data: from_data\n\n'),
        body: createByteStream('data: from_body\n\n'),
      });

      const events = await collectEvents(
        createSSEStream(mockFetchFn, '/events', {}),
      );

      expect(events).toEqual([{ data: 'from_data' }]);
    });

    it('throws TypeError when response body is null', async () => {
      const mockFetchFn = jest.fn().mockResolvedValue({
        body: null,
      });

      await expect(
        collectEvents(createSSEStream(mockFetchFn, '/events', {})),
      ).rejects.toThrow('Response body is null');
    });

    it('reconnects on mid-stream error with Last-Event-ID', async () => {
      let callCount = 0;
      const mockFetchFn = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call: stream that yields an event then errors on next pull
          let pulled = false;
          return Promise.resolve({
            body: new ReadableStream({
              pull(ctrl) {
                if (!pulled) {
                  pulled = true;
                  ctrl.enqueue(
                    new TextEncoder().encode('id: 5\ndata: first\n\n'),
                  );
                } else {
                  ctrl.error(new Error('Connection reset'));
                }
              },
            }),
          });
        }
        // Second call: successful stream
        return Promise.resolve({
          body: createByteStream('data: reconnected\n\n'),
        });
      });

      const events = await collectEvents(
        createSSEStream(mockFetchFn, '/events', {
          retryInterval: 10, // fast retry for tests
          maxRetries: 3,
        }),
      );

      expect(events).toEqual([
        { id: 5, data: 'first' },
        { data: 'reconnected' },
      ]);
      expect(mockFetchFn).toHaveBeenCalledTimes(2);

      // Second call should include Last-Event-ID header
      const secondCallHeaders = mockFetchFn.mock.calls[1][1].headers;
      expect(secondCallHeaders['last-event-id']).toBe('5');
    });

    it('respects SSE retry field for reconnection delay', async () => {
      let callCount = 0;

      const mockFetchFn = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          let pulled = false;
          return Promise.resolve({
            body: new ReadableStream({
              pull(ctrl) {
                if (!pulled) {
                  pulled = true;
                  ctrl.enqueue(
                    new TextEncoder().encode('retry: 100\ndata: first\n\n'),
                  );
                } else {
                  ctrl.error(new Error('disconnect'));
                }
              },
            }),
          });
        }
        return Promise.resolve({
          body: createByteStream('data: second\n\n'),
        });
      });

      const events = await collectEvents(
        createSSEStream(mockFetchFn, '/events', {
          retryInterval: 10,
          maxRetries: 3,
        }),
      );

      // Verify SSE retry field was respected — the event with retry: 100
      // should have been yielded and tracked
      expect(events[0].retry).toBe(100);
      expect(mockFetchFn).toHaveBeenCalledTimes(2);
    });

    it('stops reconnecting after maxRetries is exhausted', async () => {
      const mockFetchFn = jest.fn().mockRejectedValue(new Error('network'));

      await expect(
        collectEvents(
          createSSEStream(mockFetchFn, '/events', {
            retryInterval: 10,
            maxRetries: 2,
          }),
        ),
      ).rejects.toThrow('network');

      // 1 initial + 2 retries = 3 total calls
      expect(mockFetchFn).toHaveBeenCalledTimes(3);
    });

    it('does not reconnect when AbortSignal is aborted', async () => {
      const controller = new AbortController();
      let fetchCallCount = 0;

      const mockFetchFn = jest.fn().mockImplementation(() => {
        fetchCallCount++;
        let pulled = false;
        return Promise.resolve({
          body: new ReadableStream({
            pull(ctrl) {
              if (!pulled) {
                pulled = true;
                ctrl.enqueue(new TextEncoder().encode('data: batch\n\n'));
              } else {
                ctrl.error(new Error('disconnect'));
              }
            },
          }),
        });
      });

      const events = [];
      const stream = createSSEStream(mockFetchFn, '/events', {
        signal: controller.signal,
        retryInterval: 10,
        maxRetries: 3,
      });

      for await (const event of stream) {
        events.push(event);
        // Abort after first event — should prevent reconnection
        controller.abort();
      }

      expect(events).toEqual([{ data: 'batch' }]);
      expect(fetchCallCount).toBe(1);
    });

    it('does not reconnect on AbortError', async () => {
      const mockFetchFn = jest.fn().mockImplementation(() => {
        let pulled = false;
        return Promise.resolve({
          body: new ReadableStream({
            pull(ctrl) {
              if (!pulled) {
                pulled = true;
                ctrl.enqueue(new TextEncoder().encode('data: first\n\n'));
              } else {
                const abortErr = new Error('aborted');
                abortErr.name = 'AbortError';
                ctrl.error(abortErr);
              }
            },
          }),
        });
      });

      const events = await collectEvents(
        createSSEStream(mockFetchFn, '/events', {
          retryInterval: 10,
          maxRetries: 3,
        }),
      );

      expect(events).toEqual([{ data: 'first' }]);
      expect(mockFetchFn).toHaveBeenCalledTimes(1);
    });

    it('uses default maxRetries and retryInterval when not specified', async () => {
      const mockFetchFn = jest.fn().mockResolvedValue({
        body: createByteStream('data: ok\n\n'),
      });

      const events = await collectEvents(
        createSSEStream(mockFetchFn, '/events'),
      );

      expect(events).toEqual([{ data: 'ok' }]);
    });

    it('propagates initial fetch error on first attempt', async () => {
      const mockFetchFn = jest
        .fn()
        .mockRejectedValueOnce(new Error('DNS failure'))
        .mockResolvedValue({
          body: createByteStream('data: recovered\n\n'),
        });

      // maxRetries: 0 means no retries — should throw immediately
      await expect(
        collectEvents(
          createSSEStream(mockFetchFn, '/events', {
            retryInterval: 10,
            maxRetries: 0,
          }),
        ),
      ).rejects.toThrow('DNS failure');

      expect(mockFetchFn).toHaveBeenCalledTimes(1);
    });
  });
});
