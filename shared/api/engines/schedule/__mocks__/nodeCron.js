/**
 * Mock for node-cron
 * Jest can't handle node-cron's TypeScript sources and node:crypto imports
 */

const mockTasks = new Map();

const createMockTask = (callback, options) => {
  let status = 'stopped';

  return {
    start: jest.fn(() => {
      status = 'scheduled';
    }),
    stop: jest.fn(() => {
      status = 'stopped';
    }),
    getStatus: jest.fn(() => status),
    // Expose callback so tests can invoke it to exercise handler wrapping
    _callback: callback,
    _options: options,
  };
};

const cron = {
  schedule: jest.fn((expression, callback, options) => {
    const task = createMockTask(callback, options);

    // Auto-start if scheduled option is true
    if (options && options.scheduled) {
      task.start();
    }

    // Store task for potential cleanup
    const taskId = `${expression}-${Date.now()}-${Math.random()}`;
    mockTasks.set(taskId, { task, callback });

    return task;
  }),

  validate: jest.fn(expression => {
    if (!expression || typeof expression !== 'string') {
      return false;
    }

    // Simple validation - check for basic cron patterns
    // Real validation would use node-cron's validator
    const parts = expression.trim().split(/\s+/);

    // Cron expressions can have 5 or 6 fields
    if (parts.length < 5 || parts.length > 6) {
      return false;
    }

    return true;
  }),

  // Test helper to get all mock tasks
  __getMockTasks: () => mockTasks,

  // Test helper to clear mock tasks
  __clearMockTasks: () => mockTasks.clear(),
};

export default cron;
