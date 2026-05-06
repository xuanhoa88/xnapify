const swc = require('@swc/core');
const code = `const ctx = import.meta.webpackContext('./', { recursive: true });`;
const result = swc.transformSync(code, {
  jsc: { parser: { syntax: 'ecmascript' } },
  module: { type: 'es6' },
});
console.log(result.code);
