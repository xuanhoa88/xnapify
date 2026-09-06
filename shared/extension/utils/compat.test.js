/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/* global jest */

import {
  DEFAULT_EXTENSION_CAPABILITIES,
  RESERVED_CAPABILITIES,
  checkHostCompatibility,
  getGrantedCapabilities,
  getManifestContract,
  incompatibleExtensionError,
  isTrustedExtension,
  satisfiesRange,
} from './compat.js';

describe('extension compat', () => {
  describe('getManifestContract', () => {
    it('reads the xnapify block', () => {
      expect(
        getManifestContract({
          xnapify: { version: ' ^2.0.0 ', capabilities: ['db', ' hook ', 3] },
        }),
      ).toEqual({ version: '^2.0.0', capabilities: ['db', 'hook'] });
    });

    it('falls back to the default capabilities', () => {
      expect(getManifestContract({})).toEqual({
        version: null,
        capabilities: [...DEFAULT_EXTENSION_CAPABILITIES],
      });
      expect(getManifestContract(null).capabilities).toEqual([
        ...DEFAULT_EXTENSION_CAPABILITIES,
      ]);
    });

    it('never grants reserved bindings', () => {
      const granted = getGrantedCapabilities({
        xnapify: { capabilities: ['db', 'jwt', 'extension', 'env'] },
      });
      expect(granted).toContain('db');
      for (const reserved of RESERVED_CAPABILITIES) {
        expect(granted).not.toContain(reserved);
      }
    });
  });

  describe('getGrantedCapabilities', () => {
    let warn;

    beforeEach(() => {
      delete process.env.XNAPIFY_TRUSTED_EXTENSIONS;
      warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      delete process.env.XNAPIFY_TRUSTED_EXTENSIONS;
      warn.mockRestore();
    });

    it('adds declared capabilities to the defaults instead of replacing them', () => {
      const granted = getGrantedCapabilities({
        xnapify: { capabilities: ['db'] },
      });
      expect(granted).toEqual(
        expect.arrayContaining([...DEFAULT_EXTENSION_CAPABILITIES, 'db']),
      );
    });

    it('still grants the defaults for an empty declaration', () => {
      // `capabilities: []` used to grant NOTHING — not even the
      // side-effect-free defaults — so resolve('hook') threw for the two
      // in-repo extensions that ship an empty array.
      expect(getGrantedCapabilities({ xnapify: { capabilities: [] } })).toEqual(
        [...DEFAULT_EXTENSION_CAPABILITIES],
      );
    });

    it('ignores a self-declared wildcard', () => {
      // The manifest is the extension's own package.json, so "*" in it is a
      // self-grant of the whole container.
      const granted = getGrantedCapabilities({
        id: 'ext-a',
        xnapify: { capabilities: ['*', 'db'] },
      });
      expect(granted).not.toContain('*');
      expect(granted).toContain('db');
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('XNAPIFY_TRUSTED_EXTENSIONS'),
      );
    });

    it('honours the wildcard for a host-trusted extension', () => {
      process.env.XNAPIFY_TRUSTED_EXTENSIONS = 'other, @acme/reports';
      const manifest = {
        id: 'ext-b',
        name: '@acme/reports',
        xnapify: { capabilities: ['*'] },
      };
      expect(isTrustedExtension(manifest)).toBe(true);
      expect(getGrantedCapabilities(manifest)).toContain('*');
    });

    it('never grants a reserved binding, even to a trusted wildcard', () => {
      process.env.XNAPIFY_TRUSTED_EXTENSIONS = 'ext-c';
      const granted = getGrantedCapabilities({
        id: 'ext-c',
        xnapify: { capabilities: ['*', 'jwt', 'env', 'extension'] },
      });
      for (const reserved of RESERVED_CAPABILITIES) {
        expect(granted).not.toContain(reserved);
      }
    });
  });

  describe('checkHostCompatibility', () => {
    it('accepts a matching range', () => {
      expect(
        checkHostCompatibility({ xnapify: { version: '^2.0.0' } }, '2.4.1'),
      ).toEqual({ ok: true, required: '^2.0.0', host: '2.4.1' });
    });

    it('rejects a missing range', () => {
      const result = checkHostCompatibility({}, '2.0.0');
      expect(result.ok).toBe(false);
      expect(result.code).toBe('MISSING_HOST_RANGE');
    });

    it('rejects an invalid range', () => {
      const result = checkHostCompatibility(
        { xnapify: { version: 'latest-ish' } },
        '2.0.0',
      );
      expect(result.ok).toBe(false);
      expect(result.code).toBe('INVALID_HOST_RANGE');
    });

    it('rejects a host outside the range', () => {
      const result = checkHostCompatibility(
        { xnapify: { version: '^1.0.0' } },
        '2.0.0',
      );
      expect(result.ok).toBe(false);
      expect(result.code).toBe('HOST_VERSION_MISMATCH');
      expect(result.reason).toContain('running 2.0.0');
    });

    it('rejects an unparseable host version', () => {
      const result = checkHostCompatibility(
        { xnapify: { version: '^1.0.0' } },
        'unknown',
      );
      expect(result.code).toBe('UNKNOWN_HOST_VERSION');
    });

    it('uses the build-time host version by default', () => {
      const result = checkHostCompatibility({
        xnapify: { version: '>=0.0.1' },
      });
      expect(result.ok).toBe(true);

      expect(result.host).toBe(__XNAPIFY_VERSION__);
    });
  });

  describe('satisfiesRange', () => {
    it('evaluates semver ranges and treats bad input as unsatisfied', () => {
      expect(satisfiesRange('1.2.3', '^1.0.0')).toBe(true);
      expect(satisfiesRange('2.0.0', '^1.0.0')).toBe(false);
      expect(satisfiesRange('1.2.3', '*')).toBe(true);
      expect(satisfiesRange('1.2.3', undefined)).toBe(true);
      expect(satisfiesRange('nope', '^1.0.0')).toBe(false);
      expect(satisfiesRange('1.2.3', 'not a range')).toBe(false);
    });
  });

  describe('incompatibleExtensionError', () => {
    it('produces a typed 422 error', () => {
      const error = incompatibleExtensionError('ext', {
        code: 'HOST_VERSION_MISMATCH',
        reason: 'nope',
      });
      expect(error.name).toBe('IncompatibleExtensionError');
      expect(error.code).toBe('HOST_VERSION_MISMATCH');
      expect(error.status).toBe(422);
      expect(error.message).toContain('ext');
    });
  });
});
