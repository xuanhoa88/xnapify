/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import * as extractService from './services/extract';

import fs from '.';

// Mock zip-utils to avoid archiver dependency issues
jest.mock('./utils/zip-utils', () => ({
  createZip: jest.fn(),
  extractZip: jest.fn(),
}));

jest.mock('./services/extract', () => ({
  extract: jest.fn(),
}));

describe('Filesystem Engine: Extract Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should expose extract method', () => {
    expect(typeof fs.extract).toBe('function');
  });

  it('should delegate to extract service', async () => {
    const zipSource = 'test.zip';
    const extractPath = 'out';
    const options = { foo: 'bar' };

    extractService.extract.mockResolvedValue(true);

    await fs.extract(zipSource, extractPath, options);

    expect(extractService.extract).toHaveBeenCalledTimes(1);
    expect(extractService.extract).toHaveBeenCalledWith(
      fs,
      zipSource,
      extractPath,
      options,
    );
  });
});
