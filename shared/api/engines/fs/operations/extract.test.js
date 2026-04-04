/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import * as zipUtils from '../utils/zipUtils';

import { extract } from './extract';

jest.mock('../utils/zipUtils', () => ({
  extractZip: jest.fn(),
}));

describe('FS Operation: extract', () => {
  let manager;

  beforeEach(() => {
    // Mock manager (not currently used by extract operation but passed by convention)
    manager = {};
    jest.clearAllMocks();
  });

  it('should call extractZip with correct arguments', async () => {
    const zipSource = '/path/to/source.zip';
    const extractPath = '/path/to/dest';
    const options = { overwrite: true };

    // Mock successful extraction
    zipUtils.extractZip.mockResolvedValue(true);

    const result = await extract(manager, { zipSource, extractPath }, options);

    expect(zipUtils.extractZip).toHaveBeenCalledTimes(1);
    expect(zipUtils.extractZip).toHaveBeenCalledWith(
      zipSource,
      extractPath,
      options,
    );
    expect(result).toBe(true);
  });

  it('should propagate errors from extractZip', async () => {
    const error = new Error('Extraction failed');
    zipUtils.extractZip.mockRejectedValue(error);

    await expect(
      extract(manager, {
        zipSource: 'test.zip',
        extractPath: 'out',
      }),
    ).rejects.toThrow('Extraction failed');
  });
});
