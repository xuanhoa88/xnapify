/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * History module for client-side navigation
 *
 * Provides hooks and components for managing browser history and navigation
 * in a single-page application context.
 *
 * @module components/History
 *
 * @example
 * // Using hooks
 * import { useHistory, useLocation, useQuery } from '@/components/History';
 *
 * function MyComponent() {
 *   const history = useHistory();
 *   const location = useLocation();
 *   const searchParam = useQuery('id');
 *
 *   const navigate = () => history.push('/new-path');
 * }
 *
 * @example
 * // Using Link component
 * import { Link } from '@/components/History';
 *
 * function Navigation() {
 *   return <Link to="/about">About</Link>;
 * }
 */

// Hooks
export * from './hooks';

// Components
export * from './Link';
