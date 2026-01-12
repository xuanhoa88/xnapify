/**
 * Migration: Create Webhooks Table
 *
 * This migration creates the webhooks table for storing
 * webhook delivery history, status tracking, and retry support.
 */

/**
 * Run the migration
 */
export async function up({ context, Sequelize }) {
  const { queryInterface } = context;
  const { DataTypes } = Sequelize;

  await queryInterface.createTable('webhooks', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      comment: 'Unique webhook identifier',
    },
    url: {
      type: DataTypes.STRING(2048),
      allowNull: false,
      comment: 'Destination URL for the webhook',
    },
    payload: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'JSON serialized payload',
    },
    event: {
      type: DataTypes.STRING(128),
      allowNull: true,
      comment: 'Event type (e.g., user.created, order.completed)',
    },
    status: {
      type: DataTypes.ENUM('pending', 'processing', 'delivered', 'failed'),
      defaultValue: 'pending',
      allowNull: false,
      comment: 'Current delivery status',
    },
    status_code: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'HTTP response status code',
    },
    response_body: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Response body from the webhook endpoint',
    },
    error_message: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Error message if delivery failed',
    },
    error_code: {
      type: DataTypes.STRING(64),
      allowNull: true,
      comment: 'Error code for categorization',
    },
    attempts: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
      comment: 'Number of delivery attempts',
    },
    max_retries: {
      type: DataTypes.INTEGER,
      defaultValue: 3,
      allowNull: false,
      comment: 'Maximum retry attempts allowed',
    },
    next_retry_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Scheduled time for next retry attempt',
    },
    duration_ms: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Request duration in milliseconds',
    },
    has_signature: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      comment: 'Whether the webhook was signed',
    },
    headers: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'JSON serialized custom headers',
    },
    metadata: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'JSON serialized additional metadata',
    },
    delivered_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Timestamp when successfully delivered',
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

  // Add indexes for better query performance
  await queryInterface.addIndex('webhooks', ['status']);
  await queryInterface.addIndex('webhooks', ['event']);
  await queryInterface.addIndex('webhooks', ['url']);
  await queryInterface.addIndex('webhooks', ['created_at']);
  await queryInterface.addIndex('webhooks', ['next_retry_at']);
  await queryInterface.addIndex('webhooks', ['status', 'next_retry_at'], {
    name: 'webhooks_pending_retry_idx',
  });
}

/**
 * Revert the migration
 */
export async function down({ context }) {
  const { queryInterface } = context;
  await queryInterface.dropTable('webhooks');
}
