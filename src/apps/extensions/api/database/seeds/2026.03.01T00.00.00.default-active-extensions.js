/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import fs from 'fs';

/**
 * Default active extensions — seeded as active on first run.
 * Array of logical manifest names to activate.
 */
const DEFAULT_EXTENSIONS = ['@xnapify-extension/quick-access'];

async function findExtensionManifest(container, targetName) {
  const cwd = container.resolve('cwd');
  const extensionManager = container.resolve('extensionManager');
  const dirsToScan = [
    extensionManager.getInstalledExtensionsDir(),
    extensionManager.getDevExtensionsDir(cwd),
  ].filter(Boolean);

  // Scan directories for the built manifest matching the target name
  for (const dirPath of [...new Set(dirsToScan)]) {
    try {
      const files = await fs.promises.readdir(dirPath, { withFileTypes: true });
      for (const dirent of files) {
        if (!dirent.isDirectory()) continue;
        const manifest = await extensionManager.readManifest(
          dirPath,
          dirent.name,
        );
        if (manifest && manifest.name === targetName) {
          return manifest;
        }
      }
    } catch {
      // Ignore directory read errors
    }
  }
  return null;
}

/**
 * Run the seed — idempotent via findOrCreate
 */
export async function up(_, { container }) {
  const { Extension } = container.resolve('models');
  const now = new Date();

  for (const extName of DEFAULT_EXTENSIONS) {
    const manifest = await findExtensionManifest(container, extName);

    if (!manifest || !manifest.id) {
      console.warn(
        `[Seed] Could not find built manifest for default extension ${extName}, skipping seeding.`,
      );
      continue;
    }

    await Extension.findOrCreate({
      where: { key: manifest.id },
      defaults: {
        name: manifest.name,
        description: manifest.description || '',
        version: manifest.version || '0.0.0',
        is_active: true,
        created_at: now,
        updated_at: now,
      },
    });
  }
}

/**
 * Revert the seed
 */
export async function down({ Sequelize }, { container }) {
  const { Extension } = container.resolve('models');
  const extensionManager = container.resolve('extensionManager');
  const { Op } = Sequelize;

  const keysToDelete = [];

  for (const extName of DEFAULT_EXTENSIONS) {
    const manifest = await findExtensionManifest(extensionManager, extName);
    if (manifest && manifest.id) {
      keysToDelete.push(manifest.id);
    }
  }

  if (keysToDelete.length > 0) {
    await Extension.destroy({
      where: {
        key: {
          [Op.in]: keysToDelete,
        },
      },
      force: true,
    });
  }
}
