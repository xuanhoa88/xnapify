/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
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
 * @param {Object} connection - Sequelize connection instance
 * @param {Object} DataTypes - Sequelize data types
 * @returns {Model} MarketplaceListing model
 */
export default function createMarketplaceListingModel({
  connection,
  DataTypes,
}) {
  const types = DataTypes || connection.constructor.DataTypes;

  const MarketplaceListing = connection.define(
    'MarketplaceListing',
    {
      id: {
        type: types.UUID,
        defaultValue: types.UUIDV4,
        primaryKey: true,
        comment: 'Unique listing identifier',
      },

      name: {
        type: types.STRING(100),
        allowNull: false,
        validate: { notEmpty: true },
        comment: 'Display name',
      },

      key: {
        type: types.STRING(100),
        allowNull: false,
        unique: true,
        validate: { notEmpty: true },
        comment: 'Package identifier (unique across registry)',
      },

      description: {
        type: types.TEXT,
        allowNull: true,
        comment: 'Full description (markdown)',
      },

      short_description: {
        type: types.STRING(160),
        allowNull: true,
        comment: 'One-liner for card display',
      },

      category: {
        type: types.STRING(50),
        allowNull: false,
        defaultValue: 'other',
        comment: 'Marketplace category',
      },

      tags: {
        type: types.JSON,
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
        type: types.STRING(255),
        allowNull: true,
        comment: 'Icon URL or path',
      },

      screenshots: {
        type: types.JSON,
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
        type: types.STRING(20),
        allowNull: false,
        comment: 'Latest published version',
      },

      author: {
        type: types.STRING(100),
        allowNull: true,
        comment: 'Author display name',
      },

      author_id: {
        type: types.UUID,
        allowNull: true,
        comment: 'Author user ID',
      },

      package_path: {
        type: types.STRING(500),
        allowNull: true,
        comment: 'Stored package file path (fs engine)',
      },

      install_count: {
        type: types.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Download/install counter',
      },

      compatibility: {
        type: types.STRING(20),
        allowNull: true,
        comment: 'Tested with RSK version',
      },

      type: {
        type: types.STRING(10),
        allowNull: false,
        defaultValue: 'plugin',
        validate: { isIn: [['plugin', 'module']] },
        comment: 'Extension type: plugin or module',
      },

      status: {
        type: types.STRING(20),
        allowNull: false,
        defaultValue: 'published',
        validate: { isIn: [['published', 'unlisted', 'suspended']] },
        comment: 'Listing status',
      },

      published_at: {
        type: types.DATE,
        allowNull: true,
        comment: 'When listing was approved and published',
      },
    },
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

  MarketplaceListing.associate = function (models) {
    const { User, MarketplaceSubmission } = models;

    if (User) {
      MarketplaceListing.belongsTo(User, {
        foreignKey: 'author_id',
        as: 'authorUser',
      });
    }

    if (MarketplaceSubmission) {
      MarketplaceListing.hasMany(MarketplaceSubmission, {
        foreignKey: 'listing_id',
        as: 'submissions',
      });
    }
  };

  return MarketplaceListing;
}
