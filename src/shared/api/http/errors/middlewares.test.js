import { errorHandler } from './middlewares';
import {
  BadRequestError,
  TooManyRequestsError,
  MethodNotAllowedError,
} from './classes';

describe('Error Handler Middleware', () => {
  let req, res, next;
  // Mock console.error to keep test output clean
  const originalConsoleError = console.error;

  beforeAll(() => {
    console.error = jest.fn();
  });

  afterAll(() => {
    console.error = originalConsoleError;
  });

  beforeEach(() => {
    req = {
      method: 'GET',
      originalUrl: '/test',
      ip: '127.0.0.1',
      get: jest.fn().mockImplementation(header => {
        if (header === 'User-Agent') return 'jest-test';
        return null;
      }),
    };
    res = {
      headersSent: false,
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  test('should delegate to default express handler if headers sent', () => {
    res.headersSent = true;
    const err = new Error('Test Error');
    errorHandler(err, req, res, next);
    expect(next).toHaveBeenCalledWith(err);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('should handle known HttpErrors', () => {
    const err = new BadRequestError('Bad Input');
    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Bad Input',
        code: 'BAD_REQUEST',
      }),
    );
  });

  test('should handle TooManyRequestsError with Retry-After header', () => {
    const err = new TooManyRequestsError('Slow down', 60);
    errorHandler(err, req, res, next);

    expect(res.set).toHaveBeenCalledWith('Retry-After', 60);
    expect(res.status).toHaveBeenCalledWith(429);
  });

  test('should handle MethodNotAllowedError with Allow header', () => {
    const err = new MethodNotAllowedError('No GET', ['POST', 'PUT']);
    errorHandler(err, req, res, next);

    expect(res.set).toHaveBeenCalledWith('Allow', 'POST, PUT');
    expect(res.status).toHaveBeenCalledWith(405);
  });

  describe('Sequelize Error Mapping', () => {
    test('should map SequelizeUniqueConstraintError to 409 Conflict', () => {
      const err = new Error('Validation error');
      err.name = 'SequelizeUniqueConstraintError';
      err.errors = [
        {
          message: 'Email must be unique',
          path: 'email',
          value: 'duplicate@example.com',
        },
      ];

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'CONFLICT',
          error: expect.stringMatching(/must be unique/),
        }),
      );
    });

    test('should map SequelizeValidationError to 422 Unprocessable Entity', () => {
      const err = new Error('Validation error');
      err.name = 'SequelizeValidationError';
      err.errors = [{ message: 'Email is invalid', path: 'email' }];

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
        }),
      );
    });

    test('should fallback generic Sequelize errors to 500 Database Error', () => {
      const err = new Error('Connection failed');
      err.name = 'SequelizeConnectionError';

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'DATABASE_ERROR',
          error: 'Database operation failed',
        }),
      );
    });
  });

  test('should pass unhandled errors to next', () => {
    const err = new Error('Unknown Error'); // Just a standard error
    errorHandler(err, req, res, next);
    expect(next).toHaveBeenCalledWith(err);
  });
});
