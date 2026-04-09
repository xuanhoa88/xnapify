/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Template Engine
 *
 * A shared LiquidJS wrapper providing template rendering capabilities.
 * Used by the email engine and the emails app module for rendering
 * dynamic content with Liquid syntax.
 *
 * @example
 * // Render a template string
 * const html = await template.render('<p>Hello {{ name }}</p>', { name: 'World' });
 *
 * // Register a custom filter
 * template.registerFilter('upcase', v => String(v).toUpperCase());
 * const html2 = await template.render('{{ name | upcase }}', { name: 'hello' });
 */

import { Liquid } from 'liquidjs';

/**
 * Template Manager
 *
 * Manages a LiquidJS engine instance with support for custom filters,
 * tags, and configurable template roots.
 */
export class TemplateManager {
  constructor(config = {}) {
    this.config = config;

    // Create LiquidJS engine with optional file-system roots
    this.engine = new Liquid({
      root: config.root || [],
      extname: config.extname || '.liquid',
      cache: config.cache !== false,
      strictFilters: config.strictFilters || false,
      strictVariables: config.strictVariables || false,
      ...config.liquidOptions,
    });
  }

  /**
   * Render a template string with data
   * @param {string} templateString - LiquidJS template string
   * @param {Object} data - Template variables
   * @returns {Promise<string>} Rendered output
   */
  async render(templateString, data = {}) {
    if (!templateString) return templateString;

    try {
      return await this.engine.parseAndRender(templateString, data);
    } catch (error) {
      console.warn(
        `⚠️ Template rendering failed: ${error.message}. Returning empty string.`,
      );
      return '';
    }
  }

  /**
   * Render a template string and throw on error (for preview / validation)
   * @param {string} templateString - LiquidJS template string
   * @param {Object} data - Template variables
   * @returns {Promise<string>} Rendered output
   * @throws {Error} If rendering fails
   */
  async renderStrict(templateString, data = {}) {
    if (!templateString) return templateString;
    return this.engine.parseAndRender(templateString, data);
  }

  /**
   * Render a template file (resolved from configured roots)
   * @param {string} templateName - File name (without extension)
   * @param {Object} data - Template variables
   * @returns {Promise<string>} Rendered output
   */
  async renderFile(templateName, data = {}) {
    return this.engine.renderFile(templateName, data);
  }

  /**
   * Parse a template string into AST (useful for validation)
   * @param {string} templateString - LiquidJS template string
   * @returns {Promise<Array>} Parsed template tokens
   */
  async parse(templateString) {
    return this.engine.parse(templateString);
  }

  /**
   * Register a custom Liquid filter
   * @param {string} name - Filter name
   * @param {Function} fn - Filter function
   */
  registerFilter(name, fn) {
    this.engine.registerFilter(name, fn);
  }

  /**
   * Register a custom Liquid tag
   * @param {string} name - Tag name
   * @param {Object} tag - Tag implementation
   */
  registerTag(name, tag) {
    this.engine.registerTag(name, tag);
  }

  /**
   * Get the underlying LiquidJS engine (escape hatch)
   * @returns {Liquid} LiquidJS engine instance
   */
  getEngine() {
    return this.engine;
  }
}

/**
 * Create a new isolated TemplateManager instance
 *
 * @param {Object} config - Template manager configuration
 * @param {string|string[]} [config.root] - Template file root directories
 * @param {string} [config.extname='.liquid'] - Default template file extension
 * @param {boolean} [config.cache=true] - Enable template caching
 * @param {boolean} [config.strictFilters=false] - Throw on undefined filters
 * @param {boolean} [config.strictVariables=false] - Throw on undefined variables
 * @param {Object} [config.liquidOptions] - Additional LiquidJS options
 * @returns {TemplateManager} New manager instance
 */
export function createFactory(config = {}) {
  return new TemplateManager(config);
}
