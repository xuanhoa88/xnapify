/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Express-style middleware composition
 * @param {Array} middleware - Array of middleware functions
 * @returns {Function} Composed middleware function
 */
export function composeMiddleware(middleware) {
  if (!Array.isArray(middleware)) {
    throw new TypeError('Middleware stack must be an array!');
  }
  for (const fn of middleware) {
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

      if (i === middleware.length) {
        return finalNext ? Promise.resolve(finalNext()) : Promise.resolve();
      }

      let fn = middleware[i];
      if (!fn) return Promise.resolve();

      try {
        return Promise.resolve(
          fn(req, res, function next(err) {
            if (err) {
              return finalNext ? finalNext(err) : Promise.reject(err);
            }
            return dispatch(i + 1);
          }),
        );
      } catch (err) {
        return finalNext ? finalNext(err) : Promise.reject(err);
      }
    }
  };
}
