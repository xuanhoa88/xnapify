/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// Mock fs (for existsSync and fs.promises.rm, etc.)
jest.mock('fs', () => {
  const mockRm = jest.fn();
  const mockMkdir = jest.fn();
  const mockRename = jest.fn();
  const mockUnlink = jest.fn();
  const actualFs = jest.requireActual('fs');
  const mockExistsSync = jest.fn(path => {
    if (typeof path === 'string' && path.includes('node_modules')) {
      return actualFs.existsSync(path);
    }
    return false;
  });
  const mockAccess = jest.fn();

  const mockFs = {
    ...actualFs,
    promises: {
      ...actualFs.promises,
      rm: mockRm,
      mkdir: mockMkdir,
      rename: mockRename,
      unlink: mockUnlink,
      readdir: jest.fn(),
      readFile: jest.fn(),
      access: jest.fn(),
    },
    rm: mockRm,
    mkdir: mockMkdir,
    rename: mockRename,
    unlink: mockUnlink,
    existsSync: mockExistsSync,
    access: mockAccess,
  };

  return {
    default: mockFs,
    ...mockFs,
  };
});

// Mock fs/promises (the named imports used by readdir/readFile in the service)
jest.mock('fs/promises', () => ({
  readdir: jest.fn(),
  readFile: jest.fn(),
}));

import fs from 'fs';
import path from 'path';

import {
  manageExtensions,
  getActiveExtensions,
  toggleExtensionStatus,
  deleteExtension,
  installExtensionFromPackage,
} from './extension.service.js';

const mockCache = {
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
};

const mockModels = {
  Extension: {
    findAll: jest.fn(),
    create: jest.fn(),
    findOne: jest.fn(),
  },
};

const mockQueueChannel = {
  emit: jest.fn(),
  invoke: jest.fn(),
  on: jest.fn(),
  queue: {
    getJobs: jest.fn(() => []),
  },
};
const mockQueue = jest.fn(() => mockQueueChannel);

const mockExtensionManager = {
  getExtensionMetadata: () => null,
  getInstalledExtensionsDir: () => '/mock/extensions',
  getDevExtensionsDir: cwd =>
    path.resolve(cwd, process.env.XNAPIFY_EXTENSION_LOCAL_PATH || 'extensions'),
  // Mirrors the real readManifest's contract, `strict` included: null means
  // "no usable extension here", and under `strict` a manifest that exists but
  // cannot be *read* throws instead, so a caller reconciling disk against the
  // database can tell those apart. A double that swallowed both would let this
  // suite pass while the real scan deactivated every installed extension.
  readManifest: async (...args) => {
    const last = args[args.length - 1];
    const { strict = false } =
      last && typeof last === 'object' ? args.pop() : {};
    const filePath = path.join(...args, 'package.json');
    try {
      const raw = await fs.promises.readFile(filePath, 'utf8');
      const manifest = JSON.parse(raw);
      // Mirror real readManifest: always auto-generate id from name
      if (manifest.name) {
        manifest.id = manifest.name
          .replace(/[@/]/g, '')
          .replace(/[^a-z0-9]+/gi, '_')
          .toLowerCase();
      }
      return manifest;
    } catch (error) {
      // A file that was read and did not parse is an answer: the extension is
      // unusable. A file that would not open is not, and under `strict` the
      // caller gets to see the difference.
      if (strict && error.code && error.code !== 'ENOENT') throw error;
      return null;
    }
  },
  resolveExtensionDir: async key => ({
    dir: `/mock/extensions/${key}`,
    isDevExtension: true,
  }),
};

const mockContext = {
  extensionManager: mockExtensionManager,
  models: mockModels,
  cache: mockCache,
  actorId: 'user-123',
  cwd: '/test/cwd',
  queue: mockQueue,
};

describe('Extension Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQueue.mockReturnValue(mockQueueChannel);
    mockQueueChannel.queue.getJobs.mockResolvedValue([]);
    mockCache.get.mockResolvedValue(null);
  });

  describe('deleteExtension path containment', () => {
    beforeEach(() => {
      mockModels.Extension.findOne.mockResolvedValue(null);
    });

    it.each([
      ['../../../etc', 'parent traversal'],
      ['..', 'bare parent'],
      ['.', 'current directory'],
      ['', 'empty id'],
      ['/etc/passwd', 'absolute path'],
    ])(
      'rejects %s (%s) instead of handing it to the delete worker',
      async id => {
        // With no DB row the raw route parameter becomes the directory name the
        // background worker removes recursively, so anything that escapes the
        // extensions directory has to be refused before the job is enqueued.
        await expect(deleteExtension(id, mockContext)).rejects.toMatchObject({
          statusCode: 400,
        });
        expect(mockQueueChannel.emit).not.toHaveBeenCalled();
      },
    );

    it.each([['my-extension'], ['@xnapify-extension/docs']])(
      'lets a legitimate key %s past validation',
      async key => {
        // Scoped names contain a slash and must survive; this asserts the guard
        // does not reject them. The harness cannot mock the whole delete flow,
        // so anything after validation is allowed to fail differently.
        const failure = await deleteExtension(key, mockContext).catch(e => e);
        expect(failure?.statusCode).not.toBe(400);
      },
    );
  });

  describe('deleteExtension enqueue', () => {
    beforeEach(() => {
      mockModels.Extension.findOne.mockResolvedValue(null);
      fs.promises.readdir.mockResolvedValue([]);
    });

    afterEach(() => {
      mockQueueChannel.emit.mockReset();
    });

    it('fails the request when the deletion job cannot be enqueued', async () => {
      // Nothing has been removed at this point — the job is the removal. A
      // caller told "deleted" would stop looking, and the extension is still
      // installed.
      mockQueueChannel.emit.mockRejectedValue(new Error('queue unavailable'));

      await expect(
        deleteExtension('my-extension', mockContext),
      ).rejects.toThrow(/queue unavailable/);
    });

    it('reports success only once the job is on the queue', async () => {
      let enqueued = false;
      mockQueueChannel.emit.mockImplementation(
        () =>
          new Promise(resolve =>
            setImmediate(() => {
              enqueued = true;
              resolve();
            }),
          ),
      );

      await expect(deleteExtension('my-extension', mockContext)).resolves.toBe(
        true,
      );
      expect(enqueued).toBe(true);
    });
  });

  describe('manageExtensions', () => {
    it('should list extensions from DB and FS', async () => {
      // Mock FS via imported mocked module
      // Mock FS via fs.promises.readdir used in service for sequential calls
      fs.promises.readdir.mockResolvedValue([]);
      // 1st call: Installed extensions (remote)
      fs.promises.readdir.mockResolvedValueOnce([
        { name: 'fs-extension', isDirectory: () => true },
      ]);
      // 2nd call: Local extensions (local)
      fs.promises.readdir.mockResolvedValueOnce([
        { name: 'local-extension', isDirectory: () => true },
      ]);

      fs.existsSync.mockReturnValue(true);
      fs.promises.readFile.mockImplementation(path => {
        if (path.includes('fs-extension')) {
          return Promise.resolve(
            JSON.stringify({
              name: 'fs-extension',
              version: '1.0.0',
            }),
          );
        }
        if (path.includes('local-extension')) {
          return Promise.resolve(
            JSON.stringify({
              name: 'local-extension',
              version: '1.0.0',
            }),
          );
        }
        // DB extension (exists in DB, assumed in FS for this test case setup)
        if (path.includes('db-extension')) {
          return Promise.resolve(
            JSON.stringify({
              name: 'db-extension',
              version: '1.0.0',
            }),
          );
        }
        return Promise.reject('File not found');
      });

      const mockDbUpdate = jest.fn();
      mockModels.Extension.findAll.mockResolvedValue([
        {
          id: 'db-1',
          name: 'db-extension',
          key: 'db-extension',
          is_active: true,
          update: mockDbUpdate,
          toJSON: () => ({
            name: 'DB Extension',
            key: 'db-extension',
            is_active: true,
          }),
        },
      ]);

      // Set local extension path to differ from installed path
      process.env.XNAPIFY_EXTENSION_LOCAL_PATH = 'local-extensions';

      const result = await manageExtensions(mockContext);

      expect(result).toHaveLength(2);

      const fsExtension = result.find(p => p.name === 'fs-extension');
      expect(fsExtension).toBeDefined();
      expect(fsExtension.isInstalled).toBe(false);
      expect(fsExtension.source).toBe('remote');

      const localExtension = result.find(p => p.name === 'local-extension');
      expect(localExtension).toBeDefined();
      expect(localExtension.source).toBe('local');

      const dbExtension = result.find(p => p.key === 'db-extension');
      expect(dbExtension).toBeUndefined();
      expect(mockDbUpdate).toHaveBeenCalledWith({ is_active: false });
    });

    it('should deactivate DB extensions if not found on FS', async () => {
      fs.promises.readdir.mockResolvedValue([]); // No files
      const mockUpdate = jest.fn();
      mockModels.Extension.findAll.mockResolvedValue([
        {
          id: 'db-1',
          name: 'missing-extension',
          key: 'missing-extension',
          is_active: true,
          update: mockUpdate,
          toJSON: () => ({
            name: 'Missing Extension',
            key: 'missing-extension',
            is_active: true,
          }),
        },
      ]);

      const result = await manageExtensions(mockContext);
      const missingExtension = result.find(p => p.key === 'missing-extension');
      expect(missingExtension).toBeUndefined();
      expect(mockUpdate).toHaveBeenCalledWith({ is_active: false });
    });

    it('deactivates nothing when a directory could not be read', async () => {
      // A directory that will not open says nothing about what is installed in
      // it. Reading that as "uninstalled" deactivates every extension the
      // unreadable directory holds, and each one costs a manual re-enable.
      const denied = Object.assign(new Error('EACCES: permission denied'), {
        code: 'EACCES',
      });
      fs.promises.readdir.mockRejectedValue(denied);

      const mockUpdate = jest.fn();
      mockModels.Extension.findAll.mockResolvedValue([
        {
          id: 'db-1',
          name: 'installed-extension',
          key: 'installed-extension',
          is_active: true,
          update: mockUpdate,
          toJSON: () => ({
            name: 'Installed Extension',
            key: 'installed-extension',
            is_active: true,
          }),
        },
      ]);

      const result = await manageExtensions(mockContext);

      expect(mockUpdate).not.toHaveBeenCalled();
      // And it is still listed, still active — the admin page degrades to what
      // the database knows rather than to an empty list.
      const kept = result.find(p => p.key === 'installed-extension');
      expect(kept).toMatchObject({ isActive: true, isInstalled: true });
    });

    it('deactivates nothing when a manifest could not be read', async () => {
      // One level below the readdir guard: the directory lists fine, but the
      // manifest inside it will not open. This scan reads every extension's
      // package.json through one unbounded Promise.all, so a large install can
      // exhaust the descriptor table on its own — and readManifest answering
      // null for that is indistinguishable from "no extension here".
      fs.promises.readdir.mockResolvedValue([
        { name: 'installed-extension', isDirectory: () => true },
      ]);
      fs.promises.readFile.mockRejectedValue(
        Object.assign(new Error('EMFILE: too many open files'), {
          code: 'EMFILE',
        }),
      );

      const mockUpdate = jest.fn();
      mockModels.Extension.findAll.mockResolvedValue([
        {
          id: 'db-1',
          name: 'installed-extension',
          key: 'installed-extension',
          is_active: true,
          update: mockUpdate,
          toJSON: () => ({
            name: 'Installed Extension',
            key: 'installed-extension',
            is_active: true,
          }),
        },
      ]);

      const result = await manageExtensions(mockContext);

      expect(mockUpdate).not.toHaveBeenCalled();
      const kept = result.find(p => p.key === 'installed-extension');
      expect(kept).toMatchObject({ isActive: true, isInstalled: true });
    });

    it('still deactivates when a manifest is present but malformed', async () => {
      // The file was read, so nothing is hidden — the extension really is
      // unusable, and that is a different statement from "I could not look".
      fs.promises.readdir.mockResolvedValue([
        { name: 'broken-extension', isDirectory: () => true },
      ]);
      fs.promises.readFile.mockResolvedValue('{ not json');

      const mockUpdate = jest.fn();
      mockModels.Extension.findAll.mockResolvedValue([
        {
          id: 'db-1',
          name: 'broken-extension',
          key: 'broken-extension',
          is_active: true,
          update: mockUpdate,
          toJSON: () => ({
            name: 'Broken Extension',
            key: 'broken-extension',
            is_active: true,
          }),
        },
      ]);

      await manageExtensions(mockContext);

      expect(mockUpdate).toHaveBeenCalledWith({ is_active: false });
    });

    it('still deactivates when the directory is genuinely absent', async () => {
      // The distinction the guard above rests on: ENOENT is an answer, EACCES
      // is a refusal to answer.
      const absent = Object.assign(new Error('ENOENT: no such directory'), {
        code: 'ENOENT',
      });
      fs.promises.readdir.mockRejectedValue(absent);

      const mockUpdate = jest.fn();
      mockModels.Extension.findAll.mockResolvedValue([
        {
          id: 'db-1',
          name: 'missing-extension',
          key: 'missing-extension',
          is_active: true,
          update: mockUpdate,
          toJSON: () => ({
            name: 'Missing Extension',
            key: 'missing-extension',
            is_active: true,
          }),
        },
      ]);

      await manageExtensions(mockContext);

      expect(mockUpdate).toHaveBeenCalledWith({ is_active: false });
    });

    it('should re-key a DB row whose stored key no longer matches the manifest', async () => {
      // An extension id is derived from its manifest name, so changing the
      // derivation rewrites every id on the next build. The DB row still holds
      // the old one; without a name-based match it looks like the extension was
      // deleted and gets silently deactivated.
      fs.promises.readdir.mockResolvedValue([
        { name: 'renamed-extension', isDirectory: () => true },
      ]);
      fs.existsSync.mockReturnValue(true);
      fs.promises.readFile.mockImplementation(p => {
        if (p.includes('renamed-extension')) {
          return Promise.resolve(
            JSON.stringify({ name: 'renamed-extension', version: '1.0.0' }),
          );
        }
        return Promise.reject('File not found');
      });

      const mockUpdate = jest.fn();
      mockModels.Extension.findAll.mockResolvedValue([
        {
          id: 'db-1',
          name: 'renamed-extension',
          key: 'stale-key-from-an-older-build',
          is_active: true,
          update: mockUpdate,
          toJSON: () => ({
            name: 'renamed-extension',
            key: 'renamed_extension',
            is_active: true,
          }),
        },
      ]);

      const result = await manageExtensions(mockContext);

      expect(mockUpdate).toHaveBeenCalledWith({ key: 'renamed_extension' });
      expect(mockUpdate).not.toHaveBeenCalledWith({ is_active: false });

      const extension = result.find(p => p.name === 'renamed-extension');
      expect(extension).toBeDefined();
      expect(extension.isInstalled).toBe(true);
      expect(extension.isActive).toBe(true);
    });

    it('should list FS-only extensions when DB is empty', async () => {
      fs.promises.readdir.mockResolvedValue([
        { name: 'new-extension', isDirectory: () => true },
      ]);
      fs.existsSync.mockReturnValue(true);
      fs.promises.readFile.mockImplementation(p => {
        if (p.includes('new-extension')) {
          return Promise.resolve(
            JSON.stringify({
              name: 'new-extension',
              version: '1.0.0',
            }),
          );
        }
        return Promise.reject('File not found');
      });

      mockModels.Extension.findAll.mockResolvedValue([]);

      const result = await manageExtensions(mockContext);

      expect(result).toHaveLength(1);
      const extension = result[0];
      expect(extension.name).toBe('new-extension');
      expect(extension.isInstalled).toBe(false);
      expect(extension.isActive).toBe(false);
    });

    it('reads runtime state live instead of serving it from the list cache', async () => {
      // An extension that crashes while booting writes nothing to the DB and
      // never invalidates this cache, so a cached `runtime` block would keep
      // the admin UI reporting a dead extension as healthy for the whole TTL.
      mockCache.get.mockResolvedValue([
        {
          id: 'cached-extension',
          name: 'cached-extension',
          runtime: { state: 'active', error: null, loadedAt: 1 },
        },
      ]);

      const failing = {
        ...mockExtensionManager,
        getExtensionMetadata: jest.fn(() => ({
          state: 'error',
          error: new Error('boom'),
          loadedAt: null,
        })),
      };

      const result = await manageExtensions({
        ...mockContext,
        extensionManager: failing,
      });

      expect(mockModels.Extension.findAll).not.toHaveBeenCalled();
      expect(result[0].runtime).toEqual({
        state: 'error',
        error: 'boom',
        loadedAt: null,
      });
    });

    it('falls back to inactive when the manager knows nothing about an entry', async () => {
      mockCache.get.mockResolvedValue([{ id: 'unknown', name: 'unknown' }]);

      const result = await manageExtensions(mockContext);

      expect(result[0].runtime).toEqual({
        state: 'inactive',
        error: null,
        loadedAt: null,
      });
    });

    it('does not persist the runtime block into the cache', async () => {
      fs.promises.readdir.mockResolvedValue([
        { name: 'new-extension', isDirectory: () => true },
      ]);
      fs.existsSync.mockReturnValue(true);
      fs.promises.readFile.mockImplementation(p =>
        p.includes('new-extension')
          ? Promise.resolve(
              JSON.stringify({ name: 'new-extension', version: '1.0.0' }),
            )
          : Promise.reject('File not found'),
      );
      mockModels.Extension.findAll.mockResolvedValue([]);

      await manageExtensions(mockContext);

      const [, cached] = mockCache.set.mock.calls[0];
      expect(cached[0]).not.toHaveProperty('runtime');
    });
  });

  describe('getActiveExtensions', () => {
    it('should return only active extensions from DB and verify FS', async () => {
      // Mock DB to return only active extensions
      mockModels.Extension.findAll.mockResolvedValue([
        {
          id: 'active-1',
          name: 'active-p',
          key: 'active-p',
          is_active: true,
          toJSON: () => ({ name: 'Active', key: 'active-p', is_active: true }),
        },
      ]);

      // Mock FS check
      fs.existsSync.mockReturnValue(true);
      fs.promises.readFile.mockImplementation(path => {
        if (path.includes('active-p')) {
          return Promise.resolve(
            JSON.stringify({
              name: 'Active',
              version: '1.0',
            }),
          );
        }
        return Promise.reject('File not found');
      });

      const result = await getActiveExtensions(mockContext);

      expect(mockModels.Extension.findAll).toHaveBeenCalledWith({
        where: { is_active: true },
      });
      expect(result).toHaveLength(1);
      expect(result[0].key).toBe('active-p');
    });
  });

  describe('installExtensionFromPackage', () => {
    const manifest = {
      name: 'demo-extension',
      version: '2.1.0',
      description: 'Demo',
      // Any host satisfies this, so the test does not track the host version.
      xnapify: { version: '*' },
    };

    // Shape returned by the shared FS engine: per-entry outcomes, never a
    // rejection.
    const extraction = overrides => ({
      success: true,
      extractedFiles: [{ fileName: 'package.json', type: 'file', size: 64 }],
      skippedFiles: [],
      errors: [],
      totalFiles: 1,
      totalSize: 64,
      ...overrides,
    });

    let fsEngine;

    const install = () =>
      installExtensionFromPackage(
        { path: '/uploads/demo.zip', originalname: 'demo.zip' },
        { ...mockContext, fs: fsEngine },
      );

    beforeEach(() => {
      // locateExtensionRoot probes for package.json with access()
      fs.promises.access.mockResolvedValue(undefined);
      fs.promises.mkdir.mockResolvedValue(undefined);
      fs.promises.rename.mockResolvedValue(undefined);
      fs.promises.rm.mockResolvedValue(undefined);
      fs.promises.unlink.mockResolvedValue(undefined);
      fs.promises.readFile.mockResolvedValue(JSON.stringify(manifest));
      mockModels.Extension.findOne.mockResolvedValue(null);
      mockModels.Extension.create.mockResolvedValue({ key: 'demo_extension' });
      fsEngine = { extract: jest.fn(async () => extraction()) };
    });

    it('installs a package whose archive extracted completely', async () => {
      await expect(install()).resolves.toEqual({ key: 'demo_extension' });
      expect(mockQueueChannel.emit).toHaveBeenCalledWith(
        'install',
        expect.objectContaining({ extensionKey: 'demo_extension' }),
      );
    });

    it.each([
      [
        'a write failed',
        { errors: [{ fileName: 'src/index.js', error: 'ENOSPC' }] },
      ],
      [
        'an entry was skipped',
        {
          skippedFiles: [
            { fileName: 'src/index.js', reason: 'File already exists' },
          ],
        },
      ],
    ])(
      'refuses to install when %s during extraction',
      async (_case, partial) => {
        // The engine resolves `success: true` for a half-written tree, and the
        // half that landed still holds a valid package.json — so nothing later in
        // the pipeline can catch this, and the install worker would hash the
        // truncated tree as its trusted integrity baseline.
        fsEngine.extract.mockResolvedValue(extraction(partial));

        await expect(install()).rejects.toMatchObject({
          name: 'InvalidExtensionPackage',
          status: 400,
        });
        expect(mockModels.Extension.create).not.toHaveBeenCalled();
        expect(mockQueueChannel.emit).not.toHaveBeenCalled();
      },
    );

    it('refuses to install when the engine reports no entry lists', async () => {
      fsEngine.extract.mockResolvedValue(undefined);

      await expect(install()).rejects.toMatchObject({
        name: 'InvalidExtensionPackage',
        status: 400,
      });
      expect(mockModels.Extension.create).not.toHaveBeenCalled();
      expect(mockQueueChannel.emit).not.toHaveBeenCalled();
    });
  });

  describe('installExtensionFromPackage failure compensation', () => {
    const manifest = {
      name: 'demo-extension',
      version: '2.1.0',
      description: 'Demo',
      xnapify: { version: '*' },
    };
    const extraction = {
      success: true,
      extractedFiles: [{ fileName: 'package.json', type: 'file', size: 64 }],
      skippedFiles: [],
      errors: [],
      totalFiles: 1,
      totalSize: 64,
    };

    let fsEngine;

    const install = (
      file = { path: '/uploads/demo.zip', originalname: 'demo.zip' },
    ) => installExtensionFromPackage(file, { ...mockContext, fs: fsEngine });

    beforeEach(() => {
      fs.promises.access.mockResolvedValue(undefined);
      fs.promises.mkdir.mockResolvedValue(undefined);
      fs.promises.rename.mockResolvedValue(undefined);
      fs.promises.rm.mockResolvedValue(undefined);
      fs.promises.unlink.mockResolvedValue(undefined);
      fs.promises.readFile.mockResolvedValue(JSON.stringify(manifest));
      mockModels.Extension.findOne.mockResolvedValue(null);
      fsEngine = { extract: jest.fn(async () => extraction) };
    });

    it('undoes the filesystem swap when the DB row cannot be created', async () => {
      // Two cluster workers can both pass the duplicate check before either
      // has a DB row, so Extension.create failing after the move succeeded is
      // a real occurrence, not a hypothetical one — and it must not leave a
      // tree on disk with no row pointing at it.
      const dbError = Object.assign(new Error('Validation error'), {
        name: 'SequelizeUniqueConstraintError',
      });
      mockModels.Extension.create.mockRejectedValue(dbError);

      await expect(install()).rejects.toBe(dbError);

      // The failed install is moved aside and the previous tree is restored
      // to the name manageExtensions and the loader actually read from —
      // renaming the backup straight over it would collide with the tree the
      // rejected install just moved in.
      const renameCalls = fs.promises.rename.mock.calls;
      const backupCall = renameCalls[0]; // finalExtensionDir -> backupDir
      const [asideCall, restoreCall] = renameCalls.slice(-2);

      expect(asideCall[0]).toBe(backupCall[0]); // finalExtensionDir moved aside again
      expect(restoreCall[0]).toBe(backupCall[1]); // the same backupDir restored
      expect(restoreCall[1]).toBe(backupCall[0]); // back onto finalExtensionDir
    });

    it('asks the fs engine to remove the uploaded file it actually stored', async () => {
      // The custom multer storage engine sets `fileName` (capital N) — the
      // vanilla-multer `filename` this checked for is never set on a real
      // upload, so fsEngine.remove could never fire before this fix.
      mockModels.Extension.create.mockResolvedValue({ key: 'demo_extension' });
      const removedFsFiles = [];
      fsEngine.remove = jest.fn(async name => removedFsFiles.push(name));

      await install({
        path: '/uploads/demo.zip',
        originalname: 'demo.zip',
        fileName: 'stored-upload-name.zip',
      });

      expect(removedFsFiles).toEqual(['stored-upload-name.zip']);
    });

    it('still unlinks the temp archive when removing the temp extraction dir fails', async () => {
      mockModels.Extension.create.mockResolvedValue({ key: 'demo_extension' });
      // A successful install calls fs.promises.rm twice before this point —
      // once for the now-redundant install backup, then once in the `finally`
      // block for the temp extraction dir — and it's the second call this
      // test needs to fail. Each cleanup step used to share one try/catch, so
      // a throw here used to skip the unlink below it, leaking the archive.
      let rmCalls = 0;
      fs.promises.rm.mockImplementation(async () => {
        rmCalls += 1;
        if (rmCalls === 2) {
          throw Object.assign(new Error('EBUSY: resource busy'), {
            code: 'EBUSY',
          });
        }
        return undefined;
      });

      await install();

      expect(rmCalls).toBeGreaterThanOrEqual(2);
      expect(fs.promises.unlink).toHaveBeenCalledWith('/uploads/demo.zip');
    });

    it('clears the half-moved tree before restoring the backup', async () => {
      // moveDirectory falls back to copy+remove across mounts (EXDEV), which
      // this project's own docker-compose makes the normal path — and a copy
      // that dies part way leaves a truncated tree at the destination.
      // rename() refuses to replace a non-empty directory with ENOTEMPTY, so
      // dropping the backup straight back on top of that debris failed, and
      // the truncated install stayed live while the only good copy sat
      // orphaned under its .replaced- name.
      fs.promises.rename
        .mockResolvedValueOnce(undefined) // the backup swap succeeds
        .mockRejectedValueOnce(
          Object.assign(new Error('EACCES'), { code: 'EACCES' }),
        ); // moveDirectory fails with the destination populated

      await expect(install()).rejects.toThrow('EACCES');

      const [finalDir, backupDir] = fs.promises.rename.mock.calls[0];

      const restoreIdx = fs.promises.rename.mock.calls.findIndex(
        ([from, to]) => from === backupDir && to === finalDir,
      );
      expect(restoreIdx).toBeGreaterThan(-1);

      const rmIdx = fs.promises.rm.mock.calls.findIndex(
        ([target]) => target === finalDir,
      );
      expect(rmIdx).toBeGreaterThan(-1);

      expect(fs.promises.rm.mock.invocationCallOrder[rmIdx]).toBeLessThan(
        fs.promises.rename.mock.invocationCallOrder[restoreIdx],
      );
    });

    it('spares the directory when another worker won the same install', async () => {
      // Two workers install the same NEW extension concurrently. Both pass the
      // duplicate check before either has a row, so both get ENOENT on the
      // backup swap and take the no-backup path. The loser's Extension.create
      // then fails on the unique key — which is precisely the evidence that
      // the winner installed successfully. Removing the directory here deletes
      // the winner's extension and leaves its row pointing at nothing, and
      // manageExtensions cannot re-adopt a tree that is no longer on disk.
      fs.promises.rename.mockRejectedValueOnce(
        Object.assign(new Error('ENOENT'), { code: 'ENOENT' }),
      );
      const dbError = Object.assign(new Error('Validation error'), {
        name: 'SequelizeUniqueConstraintError',
      });
      mockModels.Extension.create.mockRejectedValue(dbError);

      await expect(install()).rejects.toBe(dbError);

      const finalDir = fs.promises.rename.mock.calls[0][0];
      const rmTargets = fs.promises.rm.mock.calls.map(args => args[0]);
      expect(rmTargets).not.toContain(finalDir);
    });

    it('removes the newly-moved tree when there was nothing to restore', async () => {
      // A fresh install (no prior version) has no backup to fall back to —
      // the only correct compensation is removing what was just moved in.
      // Only the first rename (the backup-swap attempt) has nothing to find;
      // moveDirectory's own rename of the extracted tree must still succeed.
      fs.promises.rename.mockImplementationOnce(async () => {
        const err = new Error('ENOENT: no such file or directory');
        err.code = 'ENOENT';
        throw err;
      });
      const dbError = new Error('DB unavailable');
      mockModels.Extension.create.mockRejectedValue(dbError);

      await expect(install()).rejects.toBe(dbError);

      const rmTargets = fs.promises.rm.mock.calls.map(args => args[0]);
      // tempExtractDir cleanup always runs; the compensating removal of the
      // newly-installed tree is the one this test is actually about.
      expect(rmTargets.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('toggleExtensionStatus', () => {
    it('should update status and enqueue background job', async () => {
      const mockExtension = {
        id: 'p1',
        key: 'extension-1',
        update: jest.fn(),
      };
      mockModels.Extension.findOne.mockResolvedValue(mockExtension);

      await toggleExtensionStatus('p1', true, mockContext);

      expect(mockExtension.update).toHaveBeenCalledWith({ is_active: true });
      expect(mockQueue).toHaveBeenCalledWith('extensions');
      expect(mockQueueChannel.emit).toHaveBeenCalledWith('toggle', {
        extensionKey: 'extension-1',
        extensionDir: expect.any(String),
        isActive: true,
        actorId: 'user-123',
        isDevExtension: true,
      });
    });
  });
});
