/**
 * Mock for uuid
 * Jest can't handle uuid's node:crypto imports
 */

let counter = 0;

export const v4 = jest.fn(() => {
  counter++;
  return `mock-uuid-${counter}`;
});

export default {
  v4,
};
