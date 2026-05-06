import fs from 'fs';
import path from 'path';

function resolveImport(importPath, currentFilePath) {
  let targetPath;
  const currentDir = path.dirname(currentFilePath);

  if (importPath.startsWith('.')) {
    targetPath = path.resolve(currentDir, importPath);
  } else if (importPath.startsWith('@shared/')) {
    const rootDir = process.cwd();
    targetPath = path.join(rootDir, importPath.replace('@shared/', 'shared/'));
  } else {
    return importPath;
  }

  if (fs.existsSync(targetPath + '.js')) return importPath + '.js';

  if (fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory()) {
    if (fs.existsSync(path.join(targetPath, 'index.js'))) {
      return importPath + (importPath.endsWith('/') ? '' : '/') + 'index.js';
    }
  }

  return importPath;
}

console.log(
  resolveImport(
    '@shared/renderer/router',
    './src/apps/(default)/views/index.js',
  ),
);
