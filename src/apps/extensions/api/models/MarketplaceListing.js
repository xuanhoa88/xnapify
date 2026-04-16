/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * MarketplaceListing Model Factory
 *
 * Public catalog entry for the marketplace hub.
 * Independent from the local Extension model.
 *
 * @param {Object} db - Sequelize connection instance
 * @param {Object} db.connection - Sequelize connection instance
 * @param {Object} db.DataTypes - Sequelize data DataTypes
 * @param {Object} container - DI container
 * @returns {Model} MarketplaceListing model
 */
export default async function createMarketplaceListingModel(
  { connection, DataTypes },
  container,
) {
  const attributes = {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      comment: 'Unique listing identifier',
    },

    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: { notEmpty: true },
      comment: 'Display name',
    },

    key: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: { notEmpty: true },
      comment: 'Package identifier (unique across registry)',
    },

    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Full description (markdown)',
    },

    short_description: {
      type: DataTypes.STRING(160),
      allowNull: true,
      comment: 'One-liner for card display',
    },

    category: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'other',
      comment: 'Marketplace category',
    },

    tags: {
      type: DataTypes.JSON,
      defaultValue: [],
      comment: 'Searchable tags array',
      get() {
        const raw = this.getDataValue('tags');
        if (raw == null) return [];
        if (typeof raw === 'string') {
          try {
            return JSON.parse(raw);
          } catch {
            return [];
          }
        }
        return Array.isArray(raw) ? raw : [];
      },
      set(value) {
        this.setDataValue('tags', Array.isArray(value) ? value : []);
      },
    },

    icon: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Icon URL or path',
    },

    screenshots: {
      type: DataTypes.JSON,
      defaultValue: [],
      comment: 'Screenshot URLs array',
      get() {
        const raw = this.getDataValue('screenshots');
        if (raw == null) return [];
        if (typeof raw === 'string') {
          try {
            return JSON.parse(raw);
          } catch {
            return [];
          }
        }
        return Array.isArray(raw) ? raw : [];
      },
      set(value) {
        this.setDataValue('screenshots', Array.isArray(value) ? value : []);
      },
    },

    version: {
      type: DataTypes.STRING(20),
      allowNull: false,
      comment: 'Latest published version',
    },

    author: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Author display name',
    },

    author_id: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Author user ID',
    },

    package_path: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'Stored package file path (fs engine)',
    },

    install_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Download/install counter',
    },

    compatibility: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'Tested with xnapify version',
    },

    type: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: 'plugin',
      validate: { isIn: [['plugin', 'module']] },
      comment: 'Extension type: plugin or module',
    },

    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'published',
      validate: { isIn: [['published', 'unlisted', 'suspended']] },
      comment: 'Listing status',
    },

    published_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When listing was approved and published',
    },
  };

  // Invoke hook to allow extensions to modify the model
  const hook = container.resolve('hook');
  await hook('models').invoke('Extension:define', {
    attributes,
    container,
  });

  const MarketplaceListing = connection.define(
    'MarketplaceListing',
    attributes,
    {
      tableName: 'marketplace_listings',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      scopes: {
        published: { where: { status: 'published' } },
        featured: {
          where: { status: 'published' },
          order: [['install_count', 'DESC']],
          limit: 10,
        },
      },
    },
  );

  MarketplaceListing.associate = async function (models) {
    MarketplaceListing.belongsTo(models.User, {
      foreignKey: 'author_id',
      as: 'authorUser',
    });

    MarketplaceListing.hasMany(models.MarketplaceSubmission, {
      foreignKey: 'listing_id',
      as: 'submissions',
    });

    const hook = container.resolve('hook');
    await hook('models').invoke('MarketplaceListing:associate', {
      models,
      model: MarketplaceListing,
      container,
    });
  };

  return MarketplaceListing;
}
