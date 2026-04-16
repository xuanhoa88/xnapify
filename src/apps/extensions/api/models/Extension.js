/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Extension Model Factory
 *
 * Creates the Extension model with the provided Sequelize instance.
 * Stores extension metadata and user associations.
 *
 * @param {Object} db - Sequelize connection instance
 * @param {Object} db.connection - Sequelize connection instance
 * @param {Object} db.DataTypes - Sequelize data types
 * @param {Object} container - DI container
 * @returns {Model} Extension model
 */
export default async function createExtensionModel(
  { connection, DataTypes },
  container,
) {
  const attributes = {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      comment: 'Unique extension identifier',
    },

    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
      },
      comment: 'Extension name',
    },

    key: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
      },
      comment: 'Extension unique key',
    },

    description: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Extension description',
    },

    version: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: '0.0.0',
      comment: 'Extension version',
    },

    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
      comment: 'Whether extension is active globally',
    },

    type: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: 'plugin',
      validate: {
        isIn: [['plugin', 'module']],
      },
      comment: 'Extension type: plugin or module',
    },

    options: {
      type: DataTypes.JSON,
      defaultValue: {},
      comment: 'Extension configuration options',
      get() {
        const raw = this.getDataValue('options');
        if (raw == null) return {};
        if (typeof raw === 'string') {
          try {
            return JSON.parse(raw);
          } catch {
            return {};
          }
        }
        return typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
      },
      set(value) {
        if (value == null) {
          this.setDataValue('options', {});
          return;
        }
        if (typeof value === 'string') {
          try {
            const parsed = JSON.parse(value);
            this.setDataValue(
              'options',
              typeof parsed === 'object' && !Array.isArray(parsed)
                ? parsed
                : {},
            );
          } catch {
            this.setDataValue('options', {});
          }
          return;
        }
        if (typeof value === 'object' && !Array.isArray(value)) {
          this.setDataValue('options', value);
        } else {
          this.setDataValue('options', {});
        }
      },
    },

    integrity: {
      type: DataTypes.STRING(64),
      allowNull: true,
      unique: true,
      comment: 'SHA-256 integrity hash of built extension files',
    },
  };

  // Invoke hook to allow extensions to modify the model
  const hook = container.resolve('hook');
  await hook('models').invoke('Extension:define', {
    attributes,
    container,
  });

  const Extension = connection.define('Extension', attributes, {
    tableName: 'extensions',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    hooks: {
      beforeCreate(instance) {
        sanitizeOptions(instance);
      },
      beforeUpdate(instance) {
        if (instance.changed('options')) {
          sanitizeOptions(instance);
        }
      },
    },
  });

  return Extension;
}

/**
 * Sanitize the `options` field to ensure it is always a plain object.
 * Strips any keys with `undefined` values and rejects arrays/primitives.
 */
function sanitizeOptions(instance) {
  let opts = instance.getDataValue('options');

  // Parse string values
  if (typeof opts === 'string') {
    try {
      opts = JSON.parse(opts);
    } catch {
      opts = {};
    }
  }

  // Must be a plain object (not null, not array)
  if (opts == null || typeof opts !== 'object' || Array.isArray(opts)) {
    instance.setDataValue('options', {});
    return;
  }

  // Strip undefined values (JSON.stringify drops them, but be explicit)
  const cleaned = {};
  for (const [key, val] of Object.entries(opts)) {
    if (val !== undefined) {
      cleaned[key] = val;
    }
  }
  instance.setDataValue('options', cleaned);
}
