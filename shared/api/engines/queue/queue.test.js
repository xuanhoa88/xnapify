/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// Mock uuid to avoid Jest compatibility issues
jest.mock('uuid');

import { Channel } from './channel';
import { createFactory } from './factory';

describe('Queue Engine', () => {
  let queue;

  beforeEach(() => {
    // Create a fresh queue instance for each test
    queue = createFactory();
  });

  afterEach(async () => {
    // Cleanup after each test
    if (queue) {
      await queue.cleanup();
    }
  });

  describe('Factory', () => {
    describe('channel creation', () => {
      it('should create a new channel', () => {
        const channel = queue('test-channel');

        expect(channel).toBeInstanceOf(Channel);
        expect(channel.name).toBe('test-channel');
      });

      it('should return existing channel', () => {
        const channel1 = queue('test-channel');
        const channel2 = queue('test-channel');

        expect(channel1).toBe(channel2);
      });

      it('should validate channel name', () => {
        const consoleErrorSpy = jest
          .spyOn(console, 'error')
          .mockImplementation();

        expect(queue('')).toBeNull();
        expect(queue(null)).toBeNull();
        expect(queue(123)).toBeNull();
        expect(queue('   ')).toBeNull();

        expect(consoleErrorSpy).toHaveBeenCalled();
        consoleErrorSpy.mockRestore();
      });

      it('should create channels with different names', () => {
        const channel1 = queue('channel-1');
        const channel2 = queue('channel-2');

        expect(channel1).not.toBe(channel2);
        expect(channel1.name).toBe('channel-1');
        expect(channel2.name).toBe('channel-2');
      });
    });

    describe('channel()', () => {
      it('should get existing channel', () => {
        const created = queue('test-channel');
        const retrieved = queue.channel('test-channel');

        expect(retrieved).toBe(created);
      });

      it('should return null for non-existing channel', () => {
        const channel = queue.channel('non-existing');
        expect(channel).toBeNull();
      });

      it('should return null for invalid input', () => {
        expect(queue.channel('')).toBeNull();
        expect(queue.channel(null)).toBeNull();
      });
    });

    describe('has()', () => {
      it('should return true for existing channel', () => {
        queue('test-channel');
        expect(queue.has('test-channel')).toBe(true);
      });

      it('should return false for non-existing channel', () => {
        expect(queue.has('non-existing')).toBe(false);
      });

      it('should return false for invalid channel names', () => {
        expect(queue.has('')).toBe(false);
        expect(queue.has(null)).toBe(false);
      });
    });

    describe('getChannelNames()', () => {
      it('should return empty array when no channels', () => {
        const names = queue.getChannelNames();
        expect(names).toEqual([]);
      });

      it('should return all channel names', () => {
        queue('channel-1');
        queue('channel-2');
        queue('channel-3');

        const names = queue.getChannelNames();

        expect(names).toHaveLength(3);
        expect(names).toContain('channel-1');
        expect(names).toContain('channel-2');
        expect(names).toContain('channel-3');
      });
    });

    describe('getStats()', () => {
      it('should return empty stats when no channels', () => {
        const stats = queue.getStats();
        expect(stats).toEqual({});
      });

      it('should return stats for all channels', () => {
        queue('channel-1');
        queue('channel-2');

        const stats = queue.getStats();

        expect(stats).toHaveProperty('channel-1');
        expect(stats).toHaveProperty('channel-2');
        expect(stats['channel-1'].name).toBe('channel-1');
        expect(stats['channel-2'].name).toBe('channel-2');
      });
    });

    describe('remove()', () => {
      it('should remove an existing channel', async () => {
        queue('test-channel');

        const result = await queue.remove('test-channel');

        expect(result).toBe(true);
        expect(queue.has('test-channel')).toBe(false);
      });

      it('should return false for non-existing channel', async () => {
        const result = await queue.remove('non-existing');
        expect(result).toBe(false);
      });

      it('should return false when removing invalid channel names', async () => {
        expect(await queue.remove('')).toBe(false);
        expect(await queue.remove(null)).toBe(false);
      });
    });

    describe('cleanup()', () => {
      it('should close all channels', async () => {
        queue('channel-1');
        queue('channel-2');
        queue('channel-3');

        await queue.cleanup();

        expect(queue.getChannelNames()).toHaveLength(0);
      });

      it('should handle cleanup on empty queue', async () => {
        await expect(queue.cleanup()).resolves.not.toThrow();
      });
    });

    describe('registerAdapter()', () => {
      it('should register a custom adapter', () => {
        class CustomAdapter {
          constructor() {}
        }

        const result = queue.registerAdapter('custom', CustomAdapter);
        expect(result).toBe(true);
      });

      it('should not override existing adapter', () => {
        class CustomAdapter {}

        queue.registerAdapter('custom', CustomAdapter);
        const result = queue.registerAdapter('custom', CustomAdapter);

        expect(result).toBe(false);
      });
    });
  });

  describe('Channel', () => {
    let channel;

    beforeEach(() => {
      channel = queue('test-channel');
    });

    describe('on()', () => {
      it('should register event handler', () => {
        const handler = jest.fn();
        const result = channel.on('test-event', handler);

        expect(result).toBe(channel); // Should return this for chaining
        expect(channel.hasHandler('test-event')).toBe(true);
      });

      it('should validate event name', () => {
        const consoleErrorSpy = jest
          .spyOn(console, 'error')
          .mockImplementation();
        const handler = jest.fn();

        channel.on('', handler);
        channel.on(null, handler);
        channel.on(123, handler);

        expect(consoleErrorSpy).toHaveBeenCalled();
        consoleErrorSpy.mockRestore();
      });

      it('should validate handler function', () => {
        const consoleErrorSpy = jest
          .spyOn(console, 'error')
          .mockImplementation();

        channel.on('test-event', 'not-a-function');
        channel.on('test-event', null);
        channel.on('test-event', 123);

        expect(consoleErrorSpy).toHaveBeenCalled();
        consoleErrorSpy.mockRestore();
      });
    });

    describe('off()', () => {
      it('should remove event handler', () => {
        const handler = jest.fn();
        channel.on('test-event', handler);

        const result = channel.off('test-event');

        expect(result).toBe(channel); // Should return this for chaining
        expect(channel.hasHandler('test-event')).toBe(false);
      });

      it('should handle removing non-existing handler', () => {
        expect(() => {
          channel.off('non-existing');
        }).not.toThrow();
      });
    });

    describe('hasHandler()', () => {
      it('should return true for existing handler', () => {
        channel.on('test-event', jest.fn());
        expect(channel.hasHandler('test-event')).toBe(true);
      });

      it('should return false for non-existing handler', () => {
        expect(channel.hasHandler('non-existing')).toBe(false);
      });
    });

    describe('getHandlerCount()', () => {
      it('should return 0 for no handlers', () => {
        expect(channel.getHandlerCount()).toBe(0);
      });

      it('should return correct count', () => {
        channel.on('event-1', jest.fn());
        channel.on('event-2', jest.fn());
        channel.on('event-3', jest.fn());

        expect(channel.getHandlerCount()).toBe(3);
      });
    });

    describe('getStats()', () => {
      it('should return channel stats', () => {
        channel.on('event-1', jest.fn());
        channel.on('event-2', jest.fn());

        const stats = channel.getStats();

        expect(stats.name).toBe('test-channel');
        expect(stats.handlers).toContain('event-1');
        expect(stats.handlers).toContain('event-2');
        expect(stats.handlerCount).toBe(2);
        expect(stats).toHaveProperty('isProcessing');
        expect(stats).toHaveProperty('queue');
      });
    });

    describe('emit()', () => {
      it('should emit event to queue', () => {
        const handler = jest.fn();
        channel.on('test-event', handler);

        const job = channel.emit('test-event', { message: 'Hello' });

        expect(job).toBeDefined();
        expect(job).toHaveProperty('id');
        expect(job.name).toBe('test-event');
        expect(job.data).toEqual({ message: 'Hello' });
      });

      it('should return null for invalid event names', () => {
        expect(channel.emit('')).toBeNull();
        expect(channel.emit(null)).toBeNull();
      });
    });

    describe('emitBulk()', () => {
      it('should emit multiple events', () => {
        const handler = jest.fn();
        channel.on('test-event', handler);

        const jobs = channel.emitBulk([
          { event: 'test-event', data: { id: 1 } },
          { event: 'test-event', data: { id: 2 } },
          { event: 'test-event', data: { id: 3 } },
        ]);

        expect(jobs).toHaveLength(3);
      });

      it('should return empty array for invalid bulk input', () => {
        expect(channel.emitBulk(null)).toEqual([]);
        expect(channel.emitBulk('not-an-array')).toEqual([]);
      });
    });

    describe('close()', () => {
      it('should close the channel', async () => {
        channel.on('test-event', jest.fn());

        await channel.close();

        expect(channel.getHandlerCount()).toBe(0);
        expect(channel.isProcessing).toBe(false);
      });
    });
  });
});
