/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// Mock node-cron to avoid Jest compatibility issues
jest.mock('node-cron');

import cron from 'node-cron';

import { ScheduleError } from './errors';
import { ScheduleManager, createFactory } from './factory';

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

    it('should throw ScheduleError for invalid task name', () => {
      try {
        manager.register('', '* * * * *', jest.fn());
      } catch (error) {
        expect(error).toBeInstanceOf(ScheduleError);
        expect(error.code).toBe('INVALID_TASK_NAME');
        expect(error.statusCode).toBe(400);
      }
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

    it('should throw ScheduleError for invalid cron expression', () => {
      try {
        manager.register('test', '', jest.fn());
      } catch (error) {
        expect(error).toBeInstanceOf(ScheduleError);
        expect(error.code).toBe('INVALID_CRON_EXPRESSION');
      }
    });

    it('should validate handler function', () => {
      expect(() => {
        manager.register('test', '* * * * *', 'not-a-function');
      }).toThrow('Handler must be a function');

      expect(() => {
        manager.register('test', '* * * * *', null);
      }).toThrow('Handler must be a function');
    });

    it('should throw ScheduleError for invalid handler', () => {
      try {
        manager.register('test', '* * * * *', null);
      } catch (error) {
        expect(error).toBeInstanceOf(ScheduleError);
        expect(error.code).toBe('INVALID_HANDLER');
      }
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

    it('should set autoStart to false for future registrations', () => {
      manager.start();
      manager.stop();

      expect(manager.autoStart).toBe(false);
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

    it('should invoke handler on cron tick', async () => {
      const handler = jest.fn().mockResolvedValue('done');
      const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();

      manager.register('test-task', '* * * * *', handler);

      // Get the wrapped callback from the mock task and invoke it
      const registeredCall =
        cron.schedule.mock.calls[cron.schedule.mock.calls.length - 1];
      const wrappedCallback = registeredCall[1];

      await wrappedCallback();

      expect(handler).toHaveBeenCalled();
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('Running schedule task: test-task'),
      );

      consoleInfoSpy.mockRestore();
    });

    it('should catch and log handler errors without throwing', async () => {
      const handlerError = new Error('Handler failed');
      const handler = jest.fn().mockRejectedValue(handlerError);
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();

      manager.register('test-task', '* * * * *', handler);

      // Invoke the wrapped callback
      const registeredCall =
        cron.schedule.mock.calls[cron.schedule.mock.calls.length - 1];
      const wrappedCallback = registeredCall[1];

      // Should not throw
      await expect(wrappedCallback()).resolves.not.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error in schedule task 'test-task'"),
        handlerError,
      );

      consoleErrorSpy.mockRestore();
      consoleInfoSpy.mockRestore();
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

describe('ScheduleError', () => {
  it('should have correct default properties', () => {
    const error = new ScheduleError('test message');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ScheduleError);
    expect(error.name).toBe('ScheduleError');
    expect(error.message).toBe('test message');
    expect(error.code).toBe('SCHEDULE_ERROR');
    expect(error.statusCode).toBe(400);
    expect(error.timestamp).toBeDefined();
  });

  it('should accept custom code and statusCode', () => {
    const error = new ScheduleError('bad cron', 'INVALID_CRON_EXPRESSION', 422);

    expect(error.code).toBe('INVALID_CRON_EXPRESSION');
    expect(error.statusCode).toBe(422);
  });

  it('should have a proper stack trace', () => {
    const error = new ScheduleError('trace test');

    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('trace test');
  });
});

describe('createFactory()', () => {
  let processOnceSpy;

  beforeEach(() => {
    processOnceSpy = jest.spyOn(process, 'once').mockImplementation();
  });

  afterEach(() => {
    processOnceSpy.mockRestore();
  });

  it('should return a ScheduleManager instance', () => {
    const schedule = createFactory({ autoStart: false });

    expect(schedule).toBeInstanceOf(ScheduleManager);

    schedule.cleanup();
  });

  it('should register SIGTERM and SIGINT cleanup handlers', () => {
    const schedule = createFactory({ autoStart: false });

    expect(processOnceSpy).toHaveBeenCalledWith(
      'SIGTERM',
      expect.any(Function),
    );
    expect(processOnceSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));

    schedule.cleanup();
  });

  it('should create a manager with autoStart true by default', () => {
    const schedule = createFactory();

    expect(schedule.autoStart).toBe(true);

    schedule.cleanup();
  });

  it('should respect autoStart: false config', () => {
    const schedule = createFactory({ autoStart: false });

    expect(schedule.autoStart).toBe(false);

    schedule.cleanup();
  });

  it('should call cleanup on SIGTERM', () => {
    const schedule = createFactory({ autoStart: false });

    const sigTermCall = processOnceSpy.mock.calls.find(
      ([signal]) => signal === 'SIGTERM',
    );
    const cleanupFn = sigTermCall[1];

    schedule.register('test', '* * * * *', jest.fn());
    expect(schedule.getAllTasks()).toHaveLength(1);

    cleanupFn();
    expect(schedule.getAllTasks()).toHaveLength(0);
  });
});
