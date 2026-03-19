/**
 * Babel plugin that replaces require.context() with an inline polyfill.
 *
 * Unlike @storybook/babel-plugin-require-context-hook which transforms
 * require.context() into __requireContext() (a global that must be
 * registered separately), this plugin inlines the fs-based implementation
 * directly into the call site. No global setup is needed.
 *
 * Usage: add to babel plugins for test environment only.
 */

module.exports = function requireContextPolyfill() {
  return {
    visitor: {
      CallExpression(path, state) {
        const callee = path.get('callee');
        if (
          !callee.isMemberExpression() ||
          !callee.get('object').isIdentifier({ name: 'require' }) ||
          !callee.get('property').isIdentifier({ name: 'context' })
        ) {
          return;
        }

        const args = path.get('arguments');
        if (args.length < 1) return;

        const filename = state.filename || state.file.opts.filename;
        const { types: t, template } = require('@babel/core');

        const dirNode = args[0].node;
        const subdirsNode =
          args.length > 1 ? args[1].node : t.booleanLiteral(false);
        const regexpNode =
          args.length > 2 ? args[2].node : t.regExpLiteral('^\\.\\/', '');

        const helperAst = template.expression(
          `
          (function () {
            var _path = require('path');
            var _fs = require('fs');

            function _enumerate(base, dir, useSub, re) {
              var result = [];
              _fs.readdirSync(_path.join(base, dir)).forEach(function (f) {
                var rel = dir + '/' + f;
                var s = _fs.lstatSync(_path.join(base, rel));
                if (s.isDirectory()) {
                  if (useSub)
                    result = result.concat(_enumerate(base, rel, useSub, re));
                } else if (re.test(rel)) {
                  result.push(rel);
                }
              });
              return result;
            }

            var _absDir = _path.resolve(
              _path.dirname(%%filename%%),
              %%directory%%,
            );
            var _keys = _enumerate(_absDir, '.', %%subdirs%%, %%regexp%%);

            function _ctx(key) {
              if (_keys.indexOf(key) < 0)
                throw new Error("Cannot find module '" + key + "'.");
              return require(_path.resolve(_absDir, key));
            }
            _ctx.keys = function () {
              return _keys;
            };
            _ctx.resolve = function (fn) {
              return (
                (%%directory%%.indexOf('./') === 0 ? './' : '') +
                _path.join(%%directory%%, fn)
              );
            };

            return _ctx;
          })()
        `,
          { plugins: ['@babel/plugin-syntax-optional-chaining'] },
        )({
          filename: t.stringLiteral(filename),
          directory: dirNode,
          subdirs: subdirsNode,
          regexp: regexpNode,
        });

        path.replaceWith(helperAst);
      },
    },
  };
};
