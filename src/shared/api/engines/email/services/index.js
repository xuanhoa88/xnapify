/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Email Services - Worker-enabled wrappers for email operations
 *
 * Services provide worker support for heavy email operations.
 * Each service accepts (manager, data, options) and decides whether
 * to use worker based on thresholds or explicit useWorker option.
 */

export { send } from './send';
