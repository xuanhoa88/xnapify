/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Composes an array of Express-style middleware functions into a single function.
 * Flattens nested arrays and executes middlewares sequentially.
 * Handles both sync and async middlewares.
 *
 * @param {...Function} middleware - Middleware functions to compose
 * @returns {Function} Composed middleware (...args) => Promise
 * @throws {TypeError} If any middleware is not a function
 */
export function composeMiddleware(...middleware) {
  const stack = middleware.flat(Infinity);

  for (let i = 0; i < stack.length; i++) {
    if (typeof stack[i] !== 'function') {
      throw new TypeError(
        `Middleware at index ${i} must be a function, got ${typeof stack[i]}`,
      );
    }
  }

  const RESOLVED = Promise.resolve();

  return function composed(...args) {
    // The last argument is treated as `next` if it's a function
    // and was not registered as part of the stack.
    const next =
      typeof args[args.length - 1] === 'function'
        ? args[args.length - 1]
        : null;
    const ctx = next ? args.slice(0, -1) : args;

    let index = -1;

    const dispatch = i => {
      if (i <= index) {
        return Promise.reject(new Error('next() called multiple times'));
      }
      index = i;

      if (i === stack.length) {
        return next ? Promise.resolve(next()) : RESOLVED;
      }

      try {
        let nextCalled = false;
        let nextPromise;

        const wrapperNext = err => {
          if (err) {
            return next ? next(err) : Promise.reject(err);
          }
          nextCalled = true;
          nextPromise = dispatch(i + 1);
          return nextPromise;
        };

        const result = stack[i](...ctx, wrapperNext);

        if (
          result !== null &&
          typeof result === 'object' &&
          typeof result.then === 'function'
        ) {
          return result;
        }
        return nextCalled ? nextPromise : Promise.resolve(result);
      } catch (error) {
        return next ? next(error) : Promise.reject(error);
      }
    };

    return dispatch(0);
  };
}

// Export default
export default composeMiddleware;
