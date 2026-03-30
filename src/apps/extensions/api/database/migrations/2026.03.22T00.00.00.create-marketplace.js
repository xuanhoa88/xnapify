/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Run the migration — create marketplace_listings and marketplace_submissions tables.
 */
export async function up({ context, Sequelize }) {
  const { queryInterface } = context;
  const { DataTypes } = Sequelize;

  // ── marketplace_listings ──────────────────────────────────────────────
  await queryInterface.createTable('marketplace_listings', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
      comment: 'Unique listing identifier',
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Display name',
    },
    key: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
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
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
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
      comment: 'Extension type: plugin or module',
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'published',
      comment: 'Listing status: published / unlisted / suspended',
    },
    published_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When listing was approved and published',
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  });

  await queryInterface.addIndex('marketplace_listings', ['key'], {
    unique: true,
  });
  await queryInterface.addIndex('marketplace_listings', ['category']);
  await queryInterface.addIndex('marketplace_listings', ['status']);
  await queryInterface.addIndex('marketplace_listings', ['author_id']);
  await queryInterface.addIndex('marketplace_listings', ['type']);
  await queryInterface.addIndex('marketplace_listings', ['install_count']);

  // ── marketplace_submissions ───────────────────────────────────────────
  await queryInterface.createTable('marketplace_submissions', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
      comment: 'Unique submission identifier',
    },
    listing_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'marketplace_listings',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      comment: 'FK to listing (for version updates)',
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Submitted extension name',
    },
    key: {
      type: DataTypes.STRING(100),
      allowNull: false,
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
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
      comment: 'Submitter user ID',
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'pending',
      comment: 'Review status: pending / approved / rejected',
    },
    review_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Admin review feedback',
    },
    reviewed_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      comment: 'Reviewer user ID',
    },
    reviewed_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Review timestamp',
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  });

  await queryInterface.addIndex('marketplace_submissions', ['listing_id']);
  await queryInterface.addIndex('marketplace_submissions', ['submitter_id']);
  await queryInterface.addIndex('marketplace_submissions', ['status']);
  await queryInterface.addIndex('marketplace_submissions', ['key']);
}

/**
 * Revert the migration
 */
export async function down({ context }) {
  const { queryInterface } = context;
  await queryInterface.dropTable('marketplace_submissions');
  await queryInterface.dropTable('marketplace_listings');
}
