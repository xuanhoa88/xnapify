/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// Mock zip-utils to avoid archiver dependency issues with Jest
jest.mock('./utils/zip-utils', () => ({
  createZip: jest.fn(),
  extractZip: jest.fn(),
}));

import { Readable } from 'stream';

import { MIDDLEWARES } from './middlewares';
import { MemoryFilesystemProvider } from './providers/memory';
import {
  formatFileSize,
  parseFileSize,
  isImageFile,
  isDocumentFile,
  isArchiveFile,
  getFileCategory,
  generateSecureFileName,
} from './utils/file-utils';

import fs, { createFactory } from '.';

describe('Filesystem Engine', () => {
  describe('Default Instance', () => {
    it('should be a filesystem manager instance', () => {
      expect(fs).toBeDefined();
      expect(fs).toHaveProperty('upload');
      expect(fs).toHaveProperty('download');
      expect(fs).toHaveProperty('remove');
      expect(fs).toHaveProperty('copy');
      expect(fs).toHaveProperty('rename');
      expect(fs).toHaveProperty('info');
      expect(fs).toHaveProperty('preview');
      expect(fs).toHaveProperty('sync');
      expect(fs).toHaveProperty('addProvider');
      expect(fs).toHaveProperty('getProvider');
      expect(fs).toHaveProperty('getProviderNames');
      expect(fs).toHaveProperty('hasProvider');
      expect(fs).toHaveProperty('getAllStats');
      expect(fs).toHaveProperty('cleanup');
      expect(fs).toHaveProperty('useUploadMiddleware');
    });

    it('should have default providers registered', () => {
      const providers = fs.getProviderNames();
      expect(Array.isArray(providers)).toBe(true);
      expect(providers.length).toBeGreaterThan(0);
    });

    it('should have memory provider by default', () => {
      expect(fs.hasProvider('memory')).toBe(true);
      const provider = fs.getProvider('memory');
      expect(provider).toBeInstanceOf(MemoryFilesystemProvider);
    });

    it('should list all registered providers', () => {
      const providers = fs.getProviderNames();
      expect(Array.isArray(providers)).toBe(true);
      expect(providers).toContain('memory');
    });
  });

  describe('createFactory()', () => {
    it('should create memory-based instance by default', () => {
      const instance = createFactory({ provider: 'memory' });
      expect(instance).toBeDefined();
      expect(instance.hasProvider('memory')).toBe(true);
    });

    it('should create independent instances', () => {
      const instance1 = createFactory({ provider: 'memory' });
      const instance2 = createFactory({ provider: 'memory' });

      const provider1 = instance1.getProvider('memory');
      const provider2 = instance2.getProvider('memory');

      // Different instances should have different providers
      expect(provider1).not.toBe(provider2);
    });

    it('should accept custom memory provider config', () => {
      const instance = createFactory({
        provider: 'memory',
        memory: {
          allowedExtensions: ['.jpg', '.png'],
        },
      });

      const provider = instance.getProvider('memory');
      expect(provider).toBeDefined();
      expect(provider.allowedExtensions).toEqual(['.jpg', '.png']);
    });

    afterEach(() => {
      // Note: We don't clean up instances here as they are isolated
    });
  });

  describe('Provider Management', () => {
    let testFs;

    beforeEach(() => {
      testFs = createFactory({ provider: 'memory' });
    });

    afterEach(() => {
      if (testFs.removeCleanupHandlers) {
        testFs.removeCleanupHandlers();
      }
    });

    it('should add custom provider', () => {
      const customProvider = {
        async store(_fileName, _fileData) {
          return {
            fileName: _fileName,
            size: 100,
            provider: 'custom',
          };
        },
        async retrieve(_fileName) {
          return Readable.from(['test']);
        },
        async delete(_fileName) {
          return true;
        },
      };

      const added = testFs.addProvider('custom', customProvider);
      expect(added).toBe(true);
      expect(testFs.hasProvider('custom')).toBe(true);
    });

    it('should not override existing provider', () => {
      const customProvider = {
        async store() {
          return { fileName: 'test' };
        },
      };

      const added = testFs.addProvider('memory', customProvider);
      expect(added).toBe(false);
    });

    it('should get provider by name', () => {
      const provider = testFs.getProvider('memory');
      expect(provider).toBeInstanceOf(MemoryFilesystemProvider);
    });

    it('should throw for non-existent provider', () => {
      expect(() => {
        testFs.getProvider('non-existent');
      }).toThrow();
    });

    it('should get all provider stats', () => {
      const stats = testFs.getAllStats();
      expect(stats).toHaveProperty('memory');
      expect(stats.memory).toBeDefined();
    });
  });

  describe('Upload Functionality', () => {
    let testFs;

    beforeEach(() => {
      testFs = createFactory({ provider: 'memory' });
    });

    afterEach(() => {
      if (testFs.removeCleanupHandlers) {
        testFs.removeCleanupHandlers();
      }
    });

    describe('Single File Upload', () => {
      it('should upload file with buffer', async () => {
        const result = await testFs.upload(
          {
            fileName: 'test.txt',
            buffer: Buffer.from('Hello World'),
            mimeType: 'text/plain',
          },
          { useWorker: false, provider: 'memory' },
        );

        expect(result.success).toBe(true);
        // Single upload also returns batch format
        expect(result.data).toHaveProperty('successful');
        expect(result.data.successful).toHaveLength(1);
        expect(result.data.successful[0]).toHaveProperty(
          'fileName',
          'test.txt',
        );
      });

      it('should upload file with buffer', async () => {
        const buffer = Buffer.from('Buffer upload test content');

        const result = await testFs.upload(
          {
            fileName: 'test-buffer.txt',
            buffer,
            mimeType: 'text/plain',
          },
          { useWorker: false, provider: 'memory' },
        );

        expect(result.success).toBe(true);
        // Single upload also returns batch format
        expect(result.data).toHaveProperty('successful');
        expect(result.data.successful).toHaveLength(1);
      });

      it('should upload file with metadata', async () => {
        const result = await testFs.upload(
          {
            fileName: 'test.jpg',
            buffer: Buffer.from('fake-image-data'),
            mimeType: 'image/jpeg',
            originalName: 'photo.jpg',
          },
          { useWorker: false, provider: 'memory' },
        );

        expect(result.success).toBe(true);
        // Single upload also returns batch format
        expect(result.data).toHaveProperty('successful');
        expect(result.data.successful).toHaveLength(1);
        expect(result.data.successful[0]).toHaveProperty(
          'fileName',
          'test.jpg',
        );
      });
    });

    describe('Batch Upload', () => {
      it('should upload multiple files', async () => {
        const files = [
          {
            fileName: 'file1.txt',
            buffer: Buffer.from('Content 1'),
            mimeType: 'text/plain',
          },
          {
            fileName: 'file2.txt',
            buffer: Buffer.from('Content 2'),
            mimeType: 'text/plain',
          },
          {
            fileName: 'file3.txt',
            buffer: Buffer.from('Content 3'),
            mimeType: 'text/plain',
          },
        ];

        const result = await testFs.upload(files, {
          useWorker: false,
          provider: 'memory',
        });

        expect(result.success).toBe(true);
        expect(result.data.successful).toHaveLength(3);
        expect(result.data.successful[0]).toHaveProperty(
          'fileName',
          'file1.txt',
        );
        expect(result.data.successful[1]).toHaveProperty(
          'fileName',
          'file2.txt',
        );
        expect(result.data.successful[2]).toHaveProperty(
          'fileName',
          'file3.txt',
        );
      });

      it('should handle partial failures in batch upload', async () => {
        const files = [
          {
            fileName: 'valid.txt',
            buffer: Buffer.from('Valid content'),
            mimeType: 'text/plain',
          },
          {
            fileName: 'invalid',
            // Missing required fields
            buffer: null,
          },
        ];

        const result = await testFs.upload(files, {
          useWorker: false,
          provider: 'memory',
        });

        // The operation should still succeed with partial results
        expect(result.success).toBe(true);
        expect(result.data.successful.length + result.data.failed.length).toBe(
          files.length,
        );
      });
    });

    describe('Worker Control', () => {
      it('should respect useWorker: false option', async () => {
        const result = await testFs.upload(
          {
            fileName: 'no-worker.txt',
            buffer: Buffer.from('Direct upload'),
            mimeType: 'text/plain',
          },
          { useWorker: false, provider: 'memory' },
        );

        expect(result.success).toBe(true);
      });

      it('should handle useWorker: true option', async () => {
        // Note: Worker functionality depends on worker pool being available
        // This test ensures the option is accepted
        const result = await testFs.upload(
          {
            fileName: 'worker.txt',
            buffer: Buffer.from('Worker upload'),
            mimeType: 'text/plain',
          },
          { useWorker: true, provider: 'memory' },
        );

        expect(result.success).toBe(true);
      });
    });
  });

  describe('Download Functionality', () => {
    let testFs;

    beforeEach(async () => {
      testFs = createFactory({ provider: 'memory' });

      // Upload test files
      await testFs.upload(
        {
          fileName: 'download-test.txt',
          buffer: Buffer.from('Test content'),
          mimeType: 'text/plain',
        },
        { useWorker: false, provider: 'memory' },
      );
    });

    afterEach(() => {
      if (testFs.removeCleanupHandlers) {
        testFs.removeCleanupHandlers();
      }
    });

    it('should download existing file', async () => {
      const result = await testFs.download('download-test.txt', {
        useWorker: false,
        provider: 'memory',
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('stream');
      expect(result.data).toHaveProperty('fileName', 'download-test.txt');
    });

    it('should handle non-existent file', async () => {
      const result = await testFs.download('non-existent.txt', {
        useWorker: false,
        provider: 'memory',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should download multiple files', async () => {
      // Upload another file
      await testFs.upload(
        {
          fileName: 'file2.txt',
          buffer: Buffer.from('Content 2'),
          mimeType: 'text/plain',
        },
        { useWorker: false, provider: 'memory' },
      );

      const result = await testFs.download(['download-test.txt', 'file2.txt'], {
        useWorker: false,
        provider: 'memory',
      });

      // Batch download will fail if any file is missing
      expect(result.success).toBe(false);
    });
  });

  describe('Copy Functionality', () => {
    let testFs;

    beforeEach(async () => {
      testFs = createFactory({ provider: 'memory' });

      await testFs.upload(
        {
          fileName: 'source.txt',
          buffer: Buffer.from('Source content'),
          mimeType: 'text/plain',
        },
        { useWorker: false, provider: 'memory' },
      );
    });

    afterEach(() => {
      if (testFs.removeCleanupHandlers) {
        testFs.removeCleanupHandlers();
      }
    });

    it('should copy file', async () => {
      const result = await testFs.copy(
        {
          source: 'source.txt',
          target: 'copy.txt',
        },
        { useWorker: false, provider: 'memory' },
      );

      expect(result.success).toBe(true);
      // Single copy operation still returns batch format
      expect(result.data).toHaveProperty('successful');
      expect(result.data.successful).toHaveLength(1);
      // Single copy operation still returns batch format
      expect(result.data).toHaveProperty('successful');
      expect(result.data.successful).toHaveLength(1);
      expect(result.data.successful[0]).toHaveProperty('source', 'source.txt');
      expect(result.data.successful[0]).toHaveProperty('target', 'copy.txt');

      // Verify both files exist
      const provider = testFs.getProvider('memory');
      expect(await provider.exists('source.txt')).toBe(true);
      expect(await provider.exists('copy.txt')).toBe(true);
    });

    it('should copy multiple files', async () => {
      await testFs.upload(
        {
          fileName: 'source2.txt',
          buffer: Buffer.from('Source 2'),
          mimeType: 'text/plain',
        },
        { useWorker: false, provider: 'memory' },
      );

      const result = await testFs.copy(
        [
          { source: 'source.txt', target: 'copy1.txt' },
          { source: 'source2.txt', target: 'copy2.txt' },
        ],
        { useWorker: false, provider: 'memory' },
      );

      expect(result.success).toBe(true);
      expect(result.data.successful).toHaveLength(2);
    });

    it('should handle copy of non-existent file', async () => {
      const result = await testFs.copy(
        {
          source: 'non-existent.txt',
          target: 'copy.txt',
        },
        { useWorker: false, provider: 'memory' },
      );

      // Non-existent file copy now wrapped in batch with failed array
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('failed');
      expect(result.data.failed).toHaveLength(1);
    });
  });

  describe('Rename Functionality', () => {
    let testFs;

    beforeEach(async () => {
      testFs = createFactory({ provider: 'memory' });

      await testFs.upload(
        {
          fileName: 'old-name.txt',
          buffer: Buffer.from('Content to rename'),
          mimeType: 'text/plain',
        },
        { useWorker: false, provider: 'memory' },
      );
    });

    afterEach(() => {
      if (testFs.removeCleanupHandlers) {
        testFs.removeCleanupHandlers();
      }
    });

    it('should rename file', async () => {
      const result = await testFs.rename(
        {
          oldName: 'old-name.txt',
          newName: 'new-name.txt',
        },
        { useWorker: false, provider: 'memory' },
      );

      expect(result.success).toBe(true);
      // Single rename operation still returns batch format
      expect(result.data).toHaveProperty('successful');
      expect(result.data.successful).toHaveLength(1);
      expect(result.data.successful[0]).toHaveProperty(
        'oldName',
        'old-name.txt',
      );
      expect(result.data.successful[0]).toHaveProperty(
        'newName',
        'new-name.txt',
      );

      // Verify old file doesn't exist and new file does
      const provider = testFs.getProvider('memory');
      expect(await provider.exists('old-name.txt')).toBe(false);
      expect(await provider.exists('new-name.txt')).toBe(true);
    });

    it('should rename multiple files', async () => {
      await testFs.upload(
        {
          fileName: 'old2.txt',
          buffer: Buffer.from('Content 2'),
          mimeType: 'text/plain',
        },
        { useWorker: false, provider: 'memory' },
      );

      const result = await testFs.rename(
        [
          { oldName: 'old-name.txt', newName: 'new1.txt' },
          { oldName: 'old2.txt', newName: 'new2.txt' },
        ],
        { useWorker: false, provider: 'memory' },
      );

      expect(result.success).toBe(true);
      expect(result.data.successful).toHaveLength(2);
    });
  });

  describe('Remove Functionality', () => {
    let testFs;

    beforeEach(async () => {
      testFs = createFactory({ provider: 'memory' });

      await testFs.upload(
        {
          fileName: 'to-delete.txt',
          buffer: Buffer.from('Delete me'),
          mimeType: 'text/plain',
        },
        { useWorker: false, provider: 'memory' },
      );
    });

    afterEach(() => {
      if (testFs.removeCleanupHandlers) {
        testFs.removeCleanupHandlers();
      }
    });

    it('should remove file', async () => {
      const result = await testFs.remove('to-delete.txt', {
        useWorker: false,
        provider: 'memory',
      });

      expect(result.success).toBe(true);
      // Single remove operation still returns batch format
      expect(result.data).toHaveProperty('successful');
      expect(result.data.successful).toHaveLength(1);
      expect(result.data.successful[0]).toHaveProperty(
        'fileName',
        'to-delete.txt',
      );

      // Verify file doesn't exist
      const provider = testFs.getProvider('memory');
      expect(await provider.exists('to-delete.txt')).toBe(false);
    });

    it('should remove multiple files', async () => {
      await testFs.upload(
        [
          {
            fileName: 'delete1.txt',
            buffer: Buffer.from('Delete 1'),
            mimeType: 'text/plain',
          },
          {
            fileName: 'delete2.txt',
            buffer: Buffer.from('Delete 2'),
            mimeType: 'text/plain',
          },
        ],
        { useWorker: false, provider: 'memory' },
      );

      const result = await testFs.remove(['delete1.txt', 'delete2.txt'], {
        useWorker: false,
        provider: 'memory',
      });

      expect(result.success).toBe(true);
      expect(result.data.successful).toHaveLength(2);
    });

    it('should handle removing non-existent file', async () => {
      const result = await testFs.remove('non-existent.txt', {
        useWorker: false,
        provider: 'memory',
      });

      // Non-existent file removal now wrapped in batch with failed array
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('failed');
      expect(result.data.failed).toHaveLength(1);
    });
  });

  describe('Info Functionality', () => {
    let testFs;

    beforeEach(async () => {
      testFs = createFactory({ provider: 'memory' });

      await testFs.upload(
        {
          fileName: 'info-test.txt',
          buffer: Buffer.from('Info content'),
          mimeType: 'text/plain',
        },
        { useWorker: false, provider: 'memory' },
      );
    });

    afterEach(() => {
      if (testFs.removeCleanupHandlers) {
        testFs.removeCleanupHandlers();
      }
    });

    it('should get file info', async () => {
      const result = await testFs.info('info-test.txt', {
        provider: 'memory',
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('fileName', 'info-test.txt');
      expect(result.data).toHaveProperty('metadata');
      expect(result.data.metadata).toHaveProperty('size');
      expect(result.data.metadata).toHaveProperty('mimeType');
    });

    it('should handle info for non-existent file', async () => {
      const result = await testFs.info('non-existent.txt', {
        provider: 'memory',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Memory Provider', () => {
    let provider;

    beforeEach(() => {
      provider = new MemoryFilesystemProvider({
        allowedExtensions: ['.txt', '.jpg', '.png'],
      });
      provider.clear();
    });

    it('should store file with buffer', async () => {
      const result = await provider.store(
        'test.txt',
        Buffer.from('Test content'),
        {
          mimeType: 'text/plain',
        },
      );

      expect(result).toHaveProperty('fileName', 'test.txt');
      expect(result).toHaveProperty('size');
      expect(result).toHaveProperty('provider', 'memory');
    });

    it('should store file with stream', async () => {
      const stream = Readable.from([
        Buffer.from('Hello '),
        Buffer.from('World'),
      ]);

      const result = await provider.store('stream.txt', stream, {
        mimeType: 'text/plain',
      });

      expect(result).toHaveProperty('fileName', 'stream.txt');
      expect(result.size).toBeGreaterThan(0);
    });

    it('should retrieve file as stream', async () => {
      await provider.store('test.txt', Buffer.from('Test content'), {
        mimeType: 'text/plain',
      });

      const result = await provider.retrieve('test.txt');
      expect(result).toHaveProperty('stream');
      expect(result).toHaveProperty('metadata');
      expect(result.stream).toBeInstanceOf(Readable);

      // Read stream to verify content
      const chunks = [];
      for await (const chunk of result.stream) {
        chunks.push(chunk);
      }
      const content = Buffer.concat(chunks).toString();
      expect(content).toBe('Test content');
    });

    it('should delete file', async () => {
      await provider.store('test.txt', Buffer.from('Delete me'), {
        mimeType: 'text/plain',
      });

      expect(await provider.exists('test.txt')).toBe(true);

      await provider.delete('test.txt');

      expect(await provider.exists('test.txt')).toBe(false);
    });

    it('should check file existence', async () => {
      expect(await provider.exists('test.txt')).toBe(false);

      await provider.store('test.txt', Buffer.from('Exists'), {
        mimeType: 'text/plain',
      });

      expect(await provider.exists('test.txt')).toBe(true);
    });

    it('should get file metadata', async () => {
      await provider.store('test.txt', Buffer.from('Metadata test'), {
        mimeType: 'text/plain',
        originalName: 'original.txt',
      });

      const metadata = await provider.getMetadata('test.txt');

      expect(metadata).toHaveProperty('fileName', 'test.txt');
      expect(metadata).toHaveProperty('size');
      expect(metadata).toHaveProperty('mimeType', 'text/plain');
      expect(metadata).toHaveProperty('createdAt');
    });

    it('should list files', async () => {
      await provider.store('file1.txt', Buffer.from('1'), {
        mimeType: 'text/plain',
      });
      await provider.store('file2.txt', Buffer.from('2'), {
        mimeType: 'text/plain',
      });
      await provider.store('file3.txt', Buffer.from('3'), {
        mimeType: 'text/plain',
      });

      const files = await provider.list('', {});

      expect(files).toHaveLength(3);
      expect(files[0]).toHaveProperty('name');
      expect(files[0]).toHaveProperty('size');
    });

    it('should copy file', async () => {
      await provider.store('source.txt', Buffer.from('Copy me'), {
        mimeType: 'text/plain',
      });

      await provider.copy('source.txt', 'copy.txt');

      expect(await provider.exists('source.txt')).toBe(true);
      expect(await provider.exists('copy.txt')).toBe(true);

      // Verify both files exist (content verification is implicit via provider implementation)
      const sourceExists = await provider.exists('source.txt');
      const copyExists = await provider.exists('copy.txt');

      expect(sourceExists).toBe(true);
      expect(copyExists).toBe(true);
    });

    it('should move/rename file', async () => {
      await provider.store('old.txt', Buffer.from('Move me'), {
        mimeType: 'text/plain',
      });

      await provider.move('old.txt', 'new.txt');

      expect(await provider.exists('old.txt')).toBe(false);
      expect(await provider.exists('new.txt')).toBe(true);
    });

    it('should clear all files', async () => {
      await provider.store('file1.txt', Buffer.from('1'), {});
      await provider.store('file2.txt', Buffer.from('2'), {});

      const statsBefore = await provider.getStats();
      expect(statsBefore.totalFiles).toBe(2);

      await provider.clear();

      const statsAfter = await provider.getStats();
      expect(statsAfter.totalFiles).toBe(0);
    });

    it('should get storage statistics', async () => {
      await provider.store('test.txt', Buffer.from('test'), {});

      const stats = await provider.getStats();

      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('provider', 'memory');
      expect(stats).toHaveProperty('totalFiles');
      expect(stats).toHaveProperty('totalSize');
      expect(stats).toHaveProperty('files');
      expect(Array.isArray(stats.files)).toBe(true);
      expect(stats.totalFiles).toBeGreaterThanOrEqual(1);
    });

    it('should validate file extensions', async () => {
      // Valid extension
      await expect(
        provider.store('test.txt', Buffer.from('Valid'), {}),
      ).resolves.toBeDefined();

      // Invalid extension (if enforced by provider config)
      // This depends on provider configuration
    });
  });

  describe('Utility Functions', () => {
    describe('File Size Utilities', () => {
      it('should format file size', () => {
        expect(formatFileSize(0)).toBe('0 Bytes');
        expect(formatFileSize(1024)).toBe('1 KB');
        expect(formatFileSize(1024 * 1024)).toBe('1 MB');
        expect(formatFileSize(1024 * 1024 * 1024)).toBe('1 GB');
      });

      it('should parse file size string', () => {
        expect(parseFileSize('0B')).toBe(0);
        expect(parseFileSize('1KB')).toBe(1024);
        expect(parseFileSize('1MB')).toBe(1024 * 1024);
        expect(parseFileSize('1GB')).toBe(1024 * 1024 * 1024);
        expect(parseFileSize('1.5MB')).toBe(1.5 * 1024 * 1024);
      });
    });

    describe('File Type Detection', () => {
      it('should detect image files', () => {
        expect(isImageFile('photo.jpg')).toBe(true);
        expect(isImageFile('image.png')).toBe(true);
        expect(isImageFile('picture.gif')).toBe(true);
        expect(isImageFile('document.pdf')).toBe(false);
      });

      it('should detect document files', () => {
        expect(isDocumentFile('doc.pdf')).toBe(true);
        expect(isDocumentFile('file.docx')).toBe(true);
        expect(isDocumentFile('sheet.xlsx')).toBe(true);
        expect(isDocumentFile('image.jpg')).toBe(false);
      });

      it('should detect archive files', () => {
        expect(isArchiveFile('archive.zip')).toBe(true);
        expect(isArchiveFile('package.tar')).toBe(true);
        expect(isArchiveFile('compressed.gz')).toBe(true);
        expect(isArchiveFile('text.txt')).toBe(false);
      });

      it('should get file category', () => {
        expect(getFileCategory('photo.jpg')).toBe('image');
        expect(getFileCategory('doc.pdf')).toBe('document');
        expect(getFileCategory('archive.zip')).toBe('archive');
        expect(getFileCategory('song.mp3')).toBe('audio');
        expect(getFileCategory('video.mp4')).toBe('video');
      });
    });

    describe('Filename Utilities', () => {
      it('should generate secure filename', () => {
        const fileName = generateSecureFileName('test.txt');
        expect(fileName).toMatch(/\.txt$/);
        expect(fileName.length).toBeGreaterThan('test.txt'.length);
      });

      it('should generate filename with options', () => {
        const fileName = generateSecureFileName('test.txt', {
          includeTimestamp: true,
          includeHash: true,
          prefix: 'upload',
        });

        expect(fileName).toContain('upload');
        expect(fileName).toMatch(/\.txt$/);
      });

      it('should generate filename without timestamp', () => {
        const fileName = generateSecureFileName('test.txt', {
          includeTimestamp: false,
          includeHash: false,
        });

        expect(fileName).toBe('test.txt');
      });
    });
  });

  describe('Middleware', () => {
    it('should have MIDDLEWARES constant', () => {
      expect(MIDDLEWARES).toBeDefined();
      expect(MIDDLEWARES).toHaveProperty('UPLOAD');
      expect(typeof MIDDLEWARES.UPLOAD).toBe('symbol');
    });

    it('should create upload middleware', () => {
      const testFs = createFactory({ provider: 'memory' });
      const middleware = testFs.useUploadMiddleware({
        fieldName: 'file',
        maxFiles: 1,
      });

      expect(typeof middleware).toBe('function');

      if (testFs.removeCleanupHandlers) {
        testFs.removeCleanupHandlers();
      }
    });

    it('should create middleware with custom options', () => {
      const testFs = createFactory({ provider: 'memory' });
      const middleware = testFs.useUploadMiddleware({
        fieldName: 'avatar',
        maxFiles: 1,
        maxFileSize: 5 * 1024 * 1024,
        allowedMimeTypes: ['image/jpeg', 'image/png'],
      });

      expect(typeof middleware).toBe('function');

      if (testFs.removeCleanupHandlers) {
        testFs.removeCleanupHandlers();
      }
    });
  });

  describe('Error Handling', () => {
    let testFs;

    beforeEach(() => {
      testFs = createFactory({ provider: 'memory' });
    });

    afterEach(() => {
      if (testFs.removeCleanupHandlers) {
        testFs.removeCleanupHandlers();
      }
    });

    it('should handle invalid upload input', async () => {
      const result = await testFs.upload([], {
        useWorker: false,
        provider: 'memory',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle download of non-existent file', async () => {
      const result = await testFs.download('does-not-exist.txt', {
        useWorker: false,
        provider: 'memory',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle invalid provider', async () => {
      // Invalid provider returns error result (not thrown)
      const result = await testFs.upload(
        {
          fileName: 'test.txt',
          buffer: Buffer.from('test'),
          mimeType: 'text/plain',
        },
        { useWorker: false, provider: 'non-existent' },
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error.code).toBe('PROVIDER_NOT_FOUND');
      expect(result.error.message).toContain('Filesystem provider not found');
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources', async () => {
      const testFs = createFactory({ provider: 'memory' });

      await testFs.upload(
        {
          fileName: 'cleanup-test.txt',
          buffer: Buffer.from('Test'),
          mimeType: 'text/plain',
        },
        { useWorker: false, provider: 'memory' },
      );

      await testFs.cleanup();

      // After cleanup, we should be able to still use the instance
      // but it's good practice to create a new one
      if (testFs.removeCleanupHandlers) {
        testFs.removeCleanupHandlers();
      }
    });
  });
});
