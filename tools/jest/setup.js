/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Jest setup file that runs BEFORE the test environment is set up.
 * Used to mock webpack-specific features like require.context.
 */

// Register require.context hook for Jest
// This is required by @storybook/babel-plugin-require-context-hook
require('@storybook/babel-plugin-require-context-hook/register')();
