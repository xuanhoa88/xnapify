/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { Readable } from 'node:stream';

import { download } from './download.js';
import { preview } from './preview.js';

const streamOf = (text = 'body') => Readable.from([Buffer.from(text)]);

const providerReturning = metadata => ({
  retrieve: async fileName => ({
    stream: streamOf(),
    metadata: { name: fileName, mimeType: 'text/plain', ...metadata },
  }),
  getMetadata: async fileName => ({
    name: fileName,
    mimeType: 'text/plain',
    ...metadata,
  }),
  exists: async () => true,
});

const managerFor = provider => ({
  getProvider: () => provider,
  defaultProvider: 'test',
});

describe('Content-Length is omitted when the size is unknown', () => {
  it('sends a real size through unchanged', async () => {
    const result = await download(
      managerFor(providerReturning({ size: 1234 })),
      'a.txt',
    );

    expect(result.success).toBe(true);
    expect(result.data.headers['Content-Length']).toBe(1234);
  });

  it.each([
    [undefined, 'header absent upstream (chunked transfer-encoding)'],
    [NaN, 'header unparseable upstream'],
  ])('omits the header entirely when size is %s — %s', async size => {
    // Declaring a length the body does not honour is worse than declaring
    // none: a conforming client stops reading at the stated byte count, so a
    // zero or NaN length turns a full file into an empty one under a 200.
    const result = await download(
      managerFor(providerReturning({ size })),
      'a.txt',
    );

    expect(result.success).toBe(true);
    expect(result.data.headers).not.toHaveProperty('Content-Length');
    expect(result.data.headers['Content-Type']).toBe('text/plain');
  });

  it('applies the same rule to preview', async () => {
    const known = await preview(
      managerFor(providerReturning({ size: 99 })),
      'a.txt',
    );
    expect(known.data.headers['Content-Length']).toBe(99);

    const unknown = await preview(
      managerFor(providerReturning({ size: undefined })),
      'a.txt',
    );
    expect(unknown.data.headers).not.toHaveProperty('Content-Length');
  });
});
