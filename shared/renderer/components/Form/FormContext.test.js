/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { z } from '@shared/validator';

import { isFieldRequired, composeEventHandlers } from './FormContext';

describe('FormContext', () => {
  describe('isFieldRequired', () => {
    it('detects required fields', () => {
      const schema = z.object({
        required: z.string(),
        optional: z.string().optional(),
      });
      expect(isFieldRequired(schema, 'required')).toBe(true);
      expect(isFieldRequired(schema, 'optional')).toBe(false);
    });

    it('detects required fields in wrapped schema (refine)', () => {
      const schema = z
        .object({
          required: z.string(),
          optional: z.string().optional(),
        })
        .refine(() => true);
      expect(isFieldRequired(schema, 'required')).toBe(true);
      expect(isFieldRequired(schema, 'optional')).toBe(false);
    });

    it('detects required fields in nested schema', () => {
      const schema = z.object({
        nested: z.object({
          field: z.string(),
        }),
      });
      // The helpers support path traversal
      expect(isFieldRequired(schema, 'nested.field')).toBe(true);
    });

    // Case where schema itself is optional - but we are checking a field inside it?
    // Not relevant.

    it('returns false for unknown fields', () => {
      const schema = z.object({ a: z.string() });
      expect(isFieldRequired(schema, 'b')).toBe(false);
    });

    it('detects required fields in extended object', () => {
      const base = z.object({ baseConfig: z.string() });
      const extended = base.extend({
        newField: z.string(),
        newOptional: z.string().optional(),
      });

      expect(isFieldRequired(extended, 'baseConfig')).toBe(true);
      expect(isFieldRequired(extended, 'newField')).toBe(true);
      expect(isFieldRequired(extended, 'newOptional')).toBe(false);
    });
  });

  describe('composeEventHandlers', () => {
    it('calls both internal and external handlers in correct order', () => {
      const order = [];
      const internal = () => order.push('internal');
      const external = () => order.push('external');

      const composed = composeEventHandlers(external, internal);
      composed();

      expect(order).toEqual(['internal', 'external']);
    });

    it('forwards all arguments to both handlers', () => {
      const internalArgs = [];
      const externalArgs = [];
      const internal = (...args) => internalArgs.push(...args);
      const external = (...args) => externalArgs.push(...args);

      const composed = composeEventHandlers(external, internal);
      composed('a', 'b', 'c');

      expect(internalArgs).toEqual(['a', 'b', 'c']);
      expect(externalArgs).toEqual(['a', 'b', 'c']);
    });

    it('works with only internal handler', () => {
      const spy = jest.fn();
      const composed = composeEventHandlers(undefined, spy);
      composed('val');

      expect(spy).toHaveBeenCalledWith('val');
    });

    it('works with only external handler', () => {
      const spy = jest.fn();
      const composed = composeEventHandlers(spy, undefined);
      composed('val');

      expect(spy).toHaveBeenCalledWith('val');
    });

    it('does not throw when neither handler is provided', () => {
      const composed = composeEventHandlers(undefined, undefined);
      expect(() => composed()).not.toThrow();
    });

    it('does not throw when handlers are null', () => {
      const composed = composeEventHandlers(null, null);
      expect(() => composed()).not.toThrow();
    });
  });
});
