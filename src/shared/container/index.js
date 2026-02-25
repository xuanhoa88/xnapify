/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Container — Lightweight isomorphic DI container
 *
 * ## Features
 *
 * - **Factory Bindings**: Fresh instance on every `resolve()` call
 * - **Singleton Bindings**: Resolved once, then cached
 * - **Instance Bindings**: Store pre-built values directly
 * - **Isomorphic**: Works on both client and server (no platform-specific APIs)
 *
 * ---
 *
 * @example <caption>Basic Usage</caption>
 *
 * // Register services in a module's init() hook
 * container.bind('users:services', () => ({
 *   controllers: { ... },
 *   utils: { ... },
 * }));
 *
 * // Resolve later
 * const services = container.resolve('users:services');
 *
 * @example <caption>Singleton</caption>
 *
 * container.singleton('db:pool', () => createPool());
 * const pool1 = container.resolve('db:pool');
 * const pool2 = container.resolve('db:pool');
 * pool1 === pool2; // true
 *
 * @example <caption>Instance</caption>
 *
 * container.instance('config', { debug: true });
 *
 * @example <caption>Inspection & Cleanup</caption>
 *
 * container.has('users:services');   // true
 * container.getBindingNames();       // ['users:services', ...]
 * container.reset('users:services'); // remove one
 * container.cleanup();               // remove all
 *
 * @example <caption>Isolated Instances</caption>
 *
 * const myContainer = createFactory();
 * myContainer.bind('foo', () => 'bar');
 */

import Container from './Container';

// Export Container class for direct use / type checking
export { Container };

/**
 * Create a new, independent Container instance.
 *
 * @returns {Container} Fresh container
 */
export function createFactory() {
  return new Container();
}

/**
 * Singleton container instance.
 * @type {Container}
 */
const container = createFactory();

export default container;
