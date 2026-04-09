/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createFactory, TemplateManager } from './factory';

describe('Template Engine', () => {
  let template;

  beforeEach(() => {
    template = createFactory();
  });

  describe('Initialization', () => {
    it('should initialize with default config', () => {
      expect(template).toBeInstanceOf(TemplateManager);
      expect(template.getEngine()).toBeDefined();
    });

    it('should accept custom LiquidJS config', () => {
      const custom = createFactory({
        liquidOptions: { strictVariables: true },
      });
      expect(custom.config.liquidOptions.strictVariables).toBe(true);
    });
  });

  describe('render()', () => {
    it('should render simple variables', async () => {
      const html = await template.render('<p>Hello {{ name }}</p>', {
        name: 'World',
      });
      expect(html).toBe('<p>Hello World</p>');
    });

    it('should return empty string on parsing failure', async () => {
      // Mock console.warn to keep test output clean
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      // LiquidJS fails if tag syntax is invalid
      const html = await template.render('Hello {% invalid_tag_here %}', {
        name: 'World',
      });
      expect(html).toBe('');
      expect(warnSpy).toHaveBeenCalled();

      warnSpy.mockRestore();
    });

    it('should return undefined or null properly when passed', async () => {
      expect(await template.render(null, {})).toBe(null);
      expect(await template.render(undefined, {})).toBe(undefined);
    });
  });

  describe('renderStrict()', () => {
    it('should render simple variables', async () => {
      const html = await template.renderStrict('<p>Hello {{ name }}</p>', {
        name: 'Jane',
      });
      expect(html).toBe('<p>Hello Jane</p>');
    });

    it('should throw an error on syntax failures', async () => {
      await expect(
        template.renderStrict('Hello {% invalid_tag_here %}', {}),
      ).rejects.toThrow();
    });
  });

  describe('registerFilter()', () => {
    it('should allow custom filters', async () => {
      template.registerFilter('upcase', v => String(v).toUpperCase());
      const html = await template.render('<p>Hello {{ name | upcase }}</p>', {
        name: 'jane',
      });
      expect(html).toBe('<p>Hello JANE</p>');
    });
  });

  describe('registerTag()', () => {
    it('should allow custom tags', async () => {
      template.registerTag('hello', {
        parse() {},
        render() {
          return 'World';
        },
      });
      const html = await template.render('<p>{% hello %}</p>');
      expect(html).toBe('<p>World</p>');
    });
  });
});
