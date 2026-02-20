/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Composes an array of Express-style middleware functions into a single function.
 * Flattens nested arrays and executes middlewares sequentially.
 * Correctly handles both sync and async middlewares.
 *
 * @param {Array<Function|Function[]>} middleware - Array of middleware fns (req, res, next)
 * @returns {Function} Composed middleware (req, res, finalNext) => Promise
 * @throws {TypeError} If input is not an array or contains non-functions
 */
export function composeMiddleware(middleware) {
  if (!Array.isArray(middleware)) {
    throw new TypeError('Middleware stack must be an array!');
  }

  // Flatten array to allow nested middleware arrays
  const flatMiddleware = middleware.flat(Infinity);

  for (const fn of flatMiddleware) {
    if (typeof fn !== 'function') {
      throw new TypeError('Middleware must be composed of functions!');
    }
  }

  return function (req, res, finalNext) {
    let index = -1;
    return dispatch(0);

    function dispatch(i) {
      if (i <= index) {
        return Promise.reject(new Error('next() called multiple times'));
      }
      index = i;

      if (i === flatMiddleware.length) {
        return finalNext ? Promise.resolve(finalNext()) : Promise.resolve();
      }

      let fn = flatMiddleware[i];
      if (typeof fn !== 'function') return Promise.resolve();

      try {
        let nextCalled = false;
        let nextPromise;

        const nextWrapper = function next(err) {
          if (err) {
            nextPromise = finalNext ? finalNext(err) : Promise.reject(err);
            return nextPromise;
          }
          nextCalled = true;
          nextPromise = dispatch(i + 1);
          return nextPromise;
        };

        const result = fn(req, res, nextWrapper);

        // If the function returns a Promise (e.g. async), return it
        if (result && typeof result.then === 'function') {
          return result;
        }
        // If it was synchronous but called next(), return the promise chain of the next() call!
        if (nextCalled) {
          return nextPromise;
        }
        // Otherwise, it was synchronous and didn't call next().
        return Promise.resolve(result);
      } catch (err) {
        return finalNext ? finalNext(err) : Promise.reject(err);
      }
    }
  };
}
