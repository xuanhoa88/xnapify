/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { z } from '@shared/validator';

import { isFieldRequired } from './FormContext';

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
});
