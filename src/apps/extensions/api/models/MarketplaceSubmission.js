/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
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
 * @param {Object} connection - Sequelize connection instance
 * @param {Object} DataTypes - Sequelize data types
 * @returns {Model} MarketplaceSubmission model
 */
export default function createMarketplaceSubmissionModel({
  connection,
  DataTypes,
}) {
  const types = DataTypes || connection.constructor.DataTypes;

  const MarketplaceSubmission = connection.define(
    'MarketplaceSubmission',
    {
      id: {
        type: types.UUID,
        defaultValue: types.UUIDV4,
        primaryKey: true,
        comment: 'Unique submission identifier',
      },

      listing_id: {
        type: types.UUID,
        allowNull: true,
        comment: 'FK to listing (for version updates to existing listings)',
      },

      name: {
        type: types.STRING(100),
        allowNull: false,
        validate: { notEmpty: true },
        comment: 'Submitted extension name',
      },

      key: {
        type: types.STRING(100),
        allowNull: false,
        validate: { notEmpty: true },
        comment: 'Submitted package identifier',
      },

      description: {
        type: types.TEXT,
        allowNull: true,
        comment: 'Submitted description',
      },

      short_description: {
        type: types.STRING(160),
        allowNull: true,
        comment: 'Submitted one-liner',
      },

      category: {
        type: types.STRING(50),
        allowNull: false,
        defaultValue: 'other',
        comment: 'Submitted category',
      },

      tags: {
        type: types.JSON,
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
        type: types.STRING(20),
        allowNull: false,
        comment: 'Submitted version',
      },

      package_path: {
        type: types.STRING(500),
        allowNull: false,
        comment: 'Uploaded package file path',
      },

      submitter_id: {
        type: types.UUID,
        allowNull: false,
        comment: 'Submitter user ID',
      },

      status: {
        type: types.STRING(20),
        allowNull: false,
        defaultValue: 'pending',
        validate: { isIn: [['pending', 'approved', 'rejected']] },
        comment: 'Review status',
      },

      review_notes: {
        type: types.TEXT,
        allowNull: true,
        comment: 'Admin review feedback',
      },

      reviewed_by: {
        type: types.UUID,
        allowNull: true,
        comment: 'Reviewer user ID',
      },

      reviewed_at: {
        type: types.DATE,
        allowNull: true,
        comment: 'Review timestamp',
      },
    },
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

  MarketplaceSubmission.associate = function (models) {
    const { User, MarketplaceListing } = models;

    if (User) {
      MarketplaceSubmission.belongsTo(User, {
        foreignKey: 'submitter_id',
        as: 'submitter',
      });

      MarketplaceSubmission.belongsTo(User, {
        foreignKey: 'reviewed_by',
        as: 'reviewer',
      });
    }

    if (MarketplaceListing) {
      MarketplaceSubmission.belongsTo(MarketplaceListing, {
        foreignKey: 'listing_id',
        as: 'listing',
      });
    }
  };

  return MarketplaceSubmission;
}
