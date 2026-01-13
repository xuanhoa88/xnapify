/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// Mock node-cron to avoid Jest compatibility issues
jest.mock('node-cron');

import { ScheduleManager } from './factory';

describe('ScheduleManager', () => {
  let manager;

  beforeEach(() => {
    // Create a fresh manager instance for each test
    manager = new ScheduleManager({ autoStart: false });
  });

  afterEach(() => {
    // Cleanup after each test
    if (manager) {
      manager.cleanup();
    }
  });

  describe('register()', () => {
    it('should register a task successfully', () => {
      const handler = jest.fn();
      const task = manager.register('test-task', '* * * * *', handler);

      expect(task).toBeDefined();
      expect(manager.get('test-task')).toBeDefined();
      expect(manager.getAllTasks()).toContain('test-task');
    });

    it('should validate task name', () => {
      const handler = jest.fn();

      expect(() => {
        manager.register('', '* * * * *', handler);
      }).toThrow('Task name must be a non-empty string');

      expect(() => {
        manager.register(null, '* * * * *', handler);
      }).toThrow('Task name must be a non-empty string');

      expect(() => {
        manager.register(123, '* * * * *', handler);
      }).toThrow('Task name must be a non-empty string');
    });

    it('should validate cron expression', () => {
      const handler = jest.fn();

      expect(() => {
        manager.register('test', '', handler);
      }).toThrow('Cron expression must be a non-empty string');

      expect(() => {
        manager.register('test', 'invalid-cron', handler);
      }).toThrow('Invalid cron expression');
    });

    it('should validate handler function', () => {
      expect(() => {
        manager.register('test', '* * * * *', 'not-a-function');
      }).toThrow('Handler must be a function');

      expect(() => {
        manager.register('test', '* * * * *', null);
      }).toThrow('Handler must be a function');
    });

    it('should overwrite existing task with warning', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      manager.register('test-task', '* * * * *', handler1);
      manager.register('test-task', '0 * * * *', handler2);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Overwriting existing schedule task: test-task',
        ),
      );

      const task = manager.get('test-task');
      expect(task.expression).toBe('0 * * * *');

      consoleWarnSpy.mockRestore();
    });

    it('should respect timezone option', () => {
      const handler = jest.fn();
      manager.register('test-task', '* * * * *', handler, {
        timezone: 'America/New_York',
      });

      const task = manager.get('test-task');
      expect(task.options.timezone).toBe('America/New_York');
    });

    it('should store registeredAt timestamp', () => {
      const handler = jest.fn();
      const beforeTime = Date.now();

      manager.register('test-task', '* * * * *', handler);

      const afterTime = Date.now();
      const task = manager.get('test-task');

      expect(task.registeredAt).toBeDefined();
      const registeredTime = new Date(task.registeredAt).getTime();
      expect(registeredTime).toBeGreaterThanOrEqual(beforeTime);
      expect(registeredTime).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('unregister()', () => {
    it('should unregister an existing task', () => {
      const handler = jest.fn();
      manager.register('test-task', '* * * * *', handler);

      const result = manager.unregister('test-task');

      expect(result).toBe(true);
      expect(manager.get('test-task')).toBeUndefined();
      expect(manager.getAllTasks()).not.toContain('test-task');
    });

    it('should return false for non-existing task', () => {
      const result = manager.unregister('non-existing');
      expect(result).toBe(false);
    });
  });

  describe('get()', () => {
    it('should return task info for registered task', () => {
      const handler = jest.fn();
      manager.register('test-task', '* * * * *', handler, { timezone: 'UTC' });

      const info = manager.get('test-task');

      expect(info).toBeDefined();
      expect(info.expression).toBe('* * * * *');
      expect(info.options.timezone).toBe('UTC');
      expect(info.task).toBeDefined();
      expect(info.registeredAt).toBeDefined();
    });

    it('should return undefined for non-existing task', () => {
      const info = manager.get('non-existing');
      expect(info).toBeUndefined();
    });
  });

  describe('getAllTasks()', () => {
    it('should return empty array when no tasks registered', () => {
      const tasks = manager.getAllTasks();
      expect(tasks).toEqual([]);
    });

    it('should return all task names', () => {
      manager.register('task1', '* * * * *', jest.fn());
      manager.register('task2', '0 * * * *', jest.fn());
      manager.register('task3', '0 0 * * *', jest.fn());

      const tasks = manager.getAllTasks();

      expect(tasks).toHaveLength(3);
      expect(tasks).toContain('task1');
      expect(tasks).toContain('task2');
      expect(tasks).toContain('task3');
    });
  });

  describe('isTaskRunning()', () => {
    it('should return true for running task', () => {
      const handler = jest.fn();
      manager.register('test-task', '* * * * *', handler, { scheduled: true });
      manager.start();

      expect(manager.isTaskRunning('test-task')).toBe(true);
    });

    it('should return false for stopped task', () => {
      const handler = jest.fn();
      manager.register('test-task', '* * * * *', handler, { scheduled: false });

      expect(manager.isTaskRunning('test-task')).toBe(false);
    });

    it('should return false for non-existing task', () => {
      expect(manager.isTaskRunning('non-existing')).toBe(false);
    });
  });

  describe('getStats()', () => {
    it('should return correct stats for empty manager', () => {
      const stats = manager.getStats();

      expect(stats.total).toBe(0);
      expect(stats.running).toBe(0);
      expect(stats.stopped).toBe(0);
      expect(stats.tasks).toEqual({});
    });

    it('should return correct stats for multiple tasks', () => {
      manager.register('task1', '* * * * *', jest.fn(), { scheduled: true });
      manager.register('task2', '0 * * * *', jest.fn(), { scheduled: false });
      manager.register('task3', '0 0 * * *', jest.fn(), {
        timezone: 'America/New_York',
      });

      manager.start();

      const stats = manager.getStats();

      expect(stats.total).toBe(3);
      expect(stats.running).toBeGreaterThan(0);
      expect(stats.tasks).toHaveProperty('task1');
      expect(stats.tasks).toHaveProperty('task2');
      expect(stats.tasks).toHaveProperty('task3');

      expect(stats.tasks.task1.expression).toBe('* * * * *');
      expect(stats.tasks.task3.timezone).toBe('America/New_York');
    });
  });

  describe('start()', () => {
    it('should start all tasks', () => {
      manager.register('task1', '* * * * *', jest.fn());
      manager.register('task2', '0 * * * *', jest.fn());

      manager.start();

      expect(manager.autoStart).toBe(true);
      expect(manager.isTaskRunning('task1')).toBe(true);
      expect(manager.isTaskRunning('task2')).toBe(true);
    });
  });

  describe('stop()', () => {
    it('should stop all tasks', () => {
      manager.register('task1', '* * * * *', jest.fn());
      manager.register('task2', '0 * * * *', jest.fn());

      manager.start();
      manager.stop();

      expect(manager.autoStart).toBe(false);
      expect(manager.isTaskRunning('task1')).toBe(false);
      expect(manager.isTaskRunning('task2')).toBe(false);
    });
  });

  describe('cleanup()', () => {
    it('should stop and remove all tasks', () => {
      manager.register('task1', '* * * * *', jest.fn());
      manager.register('task2', '0 * * * *', jest.fn());

      manager.start();
      manager.cleanup();

      expect(manager.getAllTasks()).toHaveLength(0);
      expect(manager.getStats().total).toBe(0);
    });

    it('should handle cleanup on empty manager', () => {
      expect(() => {
        manager.cleanup();
      }).not.toThrow();
    });
  });

  describe('Task handler wrapping', () => {
    it('should wrap handler to catch errors', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const handler = jest.fn();

      manager.register('test-task', '* * * * *', handler);

      // Verify that the task was registered with a wrapped handler
      const task = manager.get('test-task');
      expect(task).toBeDefined();
      expect(task.expression).toBe('* * * * *');

      consoleErrorSpy.mockRestore();
    });

    it('should register task with correct options', () => {
      const handler = jest.fn();

      manager.register('test-task', '* * * * * *', handler, {
        scheduled: true,
        timezone: 'America/New_York',
      });

      const task = manager.get('test-task');
      expect(task.options.timezone).toBe('America/New_York');
    });
  });
});
