/**
 * Migration: Create Webhooks Table
 *
 * This migration creates the webhooks table for storing
 * webhook delivery history, status tracking, and retry support.
 *
 * Schema is simplified - additional data (status_code, response_body,
 * error, headers, duration_ms, has_signature) stored in metadata JSON.
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
    event: {
      type: DataTypes.STRING(64),
      allowNull: true,
      comment: 'Event type (e.g., user.created, order.completed)',
    },
    status: {
      type: DataTypes.ENUM('pending', 'delivered', 'failed'),
      defaultValue: 'pending',
      allowNull: false,
      comment: 'Current delivery status',
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
    metadata: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment:
        'JSON: status_code, response_body, error, headers, duration_ms, has_signature, etc.',
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
