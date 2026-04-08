/**
 * Custom Jest resolver to handle Node.js modern `node:` prefixed built-in modules.
 * Older versions of Jest (like v24) fail to resolve `node:crypto`, `node:worker_threads`.
 * This strips the prefix before handing it over to Jest's default resolver.
 */
module.exports = (path, options) => {
  if (path.startsWith('node:')) {
    // Return the stripped core module name directly so Jest bypasses physical fs.stat checks
    return path.replace(/^node:/, '');
  }
  return options.defaultResolver(path, options);
};
