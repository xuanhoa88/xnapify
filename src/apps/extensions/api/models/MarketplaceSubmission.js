/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * MarketplaceSubmission Model Factory
 *
 * Represents a submission in the review queue.
 * Developers submit extensions for admin review before they appear in the catalog.
 *
 * @param {Object} db - Sequelize connection instance
 * @param {Object} db.connection - Sequelize connection instance
 * @param {Object} db.DataTypes - Sequelize data types
 * @param {Object} container - DI container
 * @returns {Model} MarketplaceSubmission model
 */
export default async function createMarketplaceSubmissionModel(
  { connection, DataTypes },
  container,
) {
  const attributes = {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      comment: 'Unique submission identifier',
    },

    listing_id: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'FK to listing (for version updates to existing listings)',
    },

    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: { notEmpty: true },
      comment: 'Submitted extension name',
    },

    key: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: { notEmpty: true },
      comment: 'Submitted package identifier',
    },

    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Submitted description',
    },

    short_description: {
      type: DataTypes.STRING(160),
      allowNull: true,
      comment: 'Submitted one-liner',
    },

    category: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'other',
      comment: 'Submitted category',
    },

    tags: {
      type: DataTypes.JSON,
      defaultValue: [],
      comment: 'Submitted tags',
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

    version: {
      type: DataTypes.STRING(20),
      allowNull: false,
      comment: 'Submitted version',
    },

    package_path: {
      type: DataTypes.STRING(500),
      allowNull: false,
      comment: 'Uploaded package file path',
    },

    submitter_id: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'Submitter user ID',
    },

    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'pending',
      validate: { isIn: [['pending', 'approved', 'rejected']] },
      comment: 'Review status',
    },

    review_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Admin review feedback',
    },

    reviewed_by: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Reviewer user ID',
    },

    reviewed_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Review timestamp',
    },
  };

  // Invoke hook to allow extensions to modify the model
  const hook = container.resolve('hook');
  await hook('models').invoke('Extension:define', {
    attributes,
    container,
  });

  const MarketplaceSubmission = connection.define(
    'MarketplaceSubmission',
    attributes,
    {
      tableName: 'marketplace_submissions',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      scopes: {
        pending: { where: { status: 'pending' } },
      },
    },
  );

  MarketplaceSubmission.associate = async function (models) {
    MarketplaceSubmission.belongsTo(models.User, {
      foreignKey: 'submitter_id',
      as: 'submitter',
    });

    MarketplaceSubmission.belongsTo(models.User, {
      foreignKey: 'reviewed_by',
      as: 'reviewer',
    });

    MarketplaceSubmission.belongsTo(models.MarketplaceListing, {
      foreignKey: 'listing_id',
      as: 'listing',
    });

    const hook = container.resolve('hook');
    await hook('models').invoke('MarketplaceSubmission:associate', {
      models,
      model: MarketplaceSubmission,
      container,
    });
  };

  return MarketplaceSubmission;
}
