/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * Derived from react-json-view by Mac Gainor (MIT License).
 * Modernized for React 18 with hooks and CSS Modules.
 */

/**
 * Returns a string "type" of the input value with enhanced number disambiguation.
 * @param {*} obj - Value to type-check
 * @returns {string} Type name
 */
export function toType(obj) {
  let type = getType(obj);
  if (type === 'number') {
    if (Number.isNaN(obj)) {
      type = 'nan';
    } else if ((obj | 0) !== obj) {
      type = 'float';
    } else {
      type = 'integer';
    }
  }
  return type;
}

/**
 * @param {*} obj
 * @returns {string}
 */
function getType(obj) {
  return {}.toString
    .call(obj)
    .match(/\s([a-zA-Z]+)/)[1]
    .toLowerCase();
}

/**
 * Parse a raw string input and return its detected type and value.
 * @param {string} input
 * @returns {{ type: string|false, value: * }}
 */
export function parseInput(input) {
  input = input.trim();
  try {
    input = JSON.stringify(JSON.parse(input));
    if (input[0] === '[') return { type: 'array', value: JSON.parse(input) };
    if (input[0] === '{') return { type: 'object', value: JSON.parse(input) };
    if (input.match(/^-?\d+\.\d+$/) || input.match(/^-?\d+e-\d+$/)) {
      return { type: 'float', value: Number(input) };
    }
    if (input.match(/^-?\d+$/) || input.match(/^-?\d+e\+\d+$/)) {
      return { type: 'integer', value: Number(input) };
    }
  } catch {
    // not serializable — fall through
  }

  const lower = input.toLowerCase();
  switch (lower) {
    case 'undefined':
      return { type: 'undefined', value: undefined };
    case 'nan':
      return { type: 'nan', value: NaN };
    case 'null':
      return { type: 'null', value: null };
    case 'true':
      return { type: 'boolean', value: true };
    case 'false':
      return { type: 'boolean', value: false };
    default:
      break;
  }
  return { type: false, value: null };
}

/**
 * Stringify a variable value for display in the editor input.
 * @param {*} value
 * @returns {string}
 */
export function stringifyVariable(value) {
  const type = toType(value);
  switch (type) {
    case 'undefined':
      return 'undefined';
    case 'nan':
      return 'NaN';
    case 'string':
      return value;
    case 'date':
    case 'function':
    case 'regexp':
      return value.toString();
    default:
      try {
        return JSON.stringify(value, null, '  ');
      } catch {
        return '';
      }
  }
}

/**
 * Deep copy a source object along a specific namespace path.
 * @param {*} src
 * @param {string[]} copyNamespace
 * @returns {*}
 */
export function deepCopy(src, copyNamespace) {
  const type = toType(src);
  let result;
  const idx = copyNamespace.shift();
  if (type === 'array') {
    result = [...src];
  } else if (type === 'object') {
    result = { ...src };
  }
  if (idx !== undefined) {
    result[idx] = deepCopy(src[idx], copyNamespace);
  }
  return result;
}
