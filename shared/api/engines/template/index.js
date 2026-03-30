/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Template Engine
 *
 * Provides LiquidJS-based template rendering as a shared engine.
 * Used by the email engine for inline template processing and by
 * the emails app module for managed email templates.
 *
 * @example
 * // Simple render
 * const html = await template.render('<p>Hello {{ name }}</p>', { name: 'World' });
 *
 * // Strict render (throws on error — for preview/validation)
 * const html2 = await template.renderStrict('{{ missing_var }}', {});
 */

import { createFactory } from './factory';

// Export the class and factory for external use
export { createFactory };

/**
 * Singleton instance of TemplateManager
 * Used application-wide via import or app.container.resolve('template')
 */
const template = createFactory();

export default template;
