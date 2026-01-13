/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { z } from 'zod';
import { fn, col, DataTypes, Op } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import { WEBHOOK_STATUS } from '../utils/constants';
import {
  createValidationErrorResponse,
  createSuccessResponse,
  createErrorResponse,
} from '../utils/adapter-responses';
import {
  eventSchema,
  metadataSchema,
  retriesSchema,
  statusSchema,
} from '../utils/adapter-schemas';

/**
 * Database Adapter Options Schema
 */
const databaseOptionsSchema = z.object({
  event: eventSchema,
  retries: retriesSchema.optional(),
  metadata: metadataSchema,
  status: statusSchema.optional(),
});

const sendInputSchema = databaseOptionsSchema.passthrough();
// validateInput is no longer needed as we validate directly in send()

// Update status input schema
const updateStatusSchema = z.object({
  webhookId: z.string().uuid(),
  result: z.object({
    success: z.boolean(),
    attempts: z.number().int().min(1).optional(),
    nextRetryAt: z.date().optional(),
  }),
});

// Get webhooks query schema
const getWebhooksSchema = z.object({
  status: statusSchema.optional(),
  event: z.string().max(1024).optional(),
  fromDate: z.date().optional(),
  toDate: z.date().optional(),
  limit: z.number().int().min(1).max(100).optional().default(20),
  offset: z.number().int().min(0).optional().default(0),
  search: z.string().optional(),
});

// Cleanup options schema
const cleanupSchema = z.object({
  olderThan: z.number().int().min(1).max(365).optional().default(30),
  includeAll: z.boolean().optional().default(false),
});

// Connection schema - validates Sequelize-like connection object
const connectionSchema = z
  .object({
    define: z.function(),
    models: z.record(z.any()).optional(),
    authenticate: z.function().optional(),
  })
  .passthrough();

/**
 * Define the Webhook model if not already defined
 * @private
 */
function defineModel(connection) {
  return connection.define(
    'Webhook',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      event: {
        type: DataTypes.STRING(1024),
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM('pending', 'delivered', 'failed'),
        defaultValue: 'pending',
      },
      attempts: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      max_retries: {
        type: DataTypes.INTEGER,
        defaultValue: 3,
      },
      next_retry_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      metadata: {
        type: DataTypes.TEXT,
        allowNull: true,
        get() {
          try {
            const value = this.getDataValue('metadata');
            if (!value) return null;
            return JSON.parse(value);
          } catch {
            return null;
          }
        },
        set(value) {
          this.setDataValue('metadata', value ? JSON.stringify(value) : null);
        },
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
    },
    {
      tableName: 'webhooks',
      timestamps: true,
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  );
}

/**
 * Database Adapter for webhooks
 * Persists all webhooks to the local database for tracking and retry support.
 *
 * Note: Connection must be set externally via config.connection or by setting
 * the connection property directly. This adapter does not auto-connect.
 */
export class DatabaseWebhookAdapter {
  _connection = null;

  constructor(config = {}) {
    this.tableName = config.tableName || 'webhooks';
    if (config.connection) {
      this.setConnection(config.connection);
    }
  }

  /**
   * Get the database connection
   * @returns {Object|null} Sequelize connection instance
   */
  getConnection() {
    // eslint-disable-next-line no-underscore-dangle
    return this._connection;
  }

  /**
   * Set the database connection
   * @param {Object} connection - Sequelize connection instance
   * @throws {Error} If connection is invalid
   */
  setConnection(connection) {
    // Validate connection using Zod
    const validation = connectionSchema.safeParse(connection);
    if (!validation.success) {
      throw new Error(
        `DatabaseWebhookAdapter: Invalid connection - ${validation.error.message}`,
      );
    }
    // eslint-disable-next-line no-underscore-dangle
    this._connection = connection;
  }

  /**
   * Check if connection is configured
   * @returns {boolean} True if connection is set
   */
  hasConnection() {
    // eslint-disable-next-line no-underscore-dangle
    return this._connection != null;
  }

  /**
   * Get database connection (internal use)
   * @private
   * @throws {Error} If connection is not configured
   */
  getDb() {
    // eslint-disable-next-line no-underscore-dangle
    if (!this._connection) {
      throw new Error(
        'DatabaseWebhookAdapter: No database connection configured. ' +
          'Set connection via constructor config or setConnection() method.',
      );
    }
    // eslint-disable-next-line no-underscore-dangle
    return this._connection;
  }

  /**
   * Get the webhooks model
   * @private
   */
  getModel() {
    const connection = this.getDb();
    return connection.models.Webhook || defineModel(connection);
  }

  /**
   * Send a webhook (stores in database)
   * Note: This adapter only stores the webhook, actual HTTP delivery
   * should be handled by the HTTP adapter or worker
   *
   * @param {any} data - Data to store
   * @param {Object} options - Options
   * @returns {Promise<Object>} Result with webhook record
   */
  async send(data, options = {}) {
    // In this flat adapter model, 'data' contains everything.
    // 'options' is kept for backward compatibility but merged if provided.
    const input = { ...data, ...options };
    const validation = sendInputSchema.safeParse(input);

    if (!validation.success) {
      return createValidationErrorResponse('database', validation.error);
    }

    const { event, status, retries, ...metadata } = validation.data;
    const startTime = Date.now();
    const webhookId = uuidv4();

    try {
      const Webhook = this.getModel();

      const record = await Webhook.create({
        id: webhookId,
        event,
        status: status || WEBHOOK_STATUS.DELIVERED,
        max_retries: retries || 3,
        metadata,
      });

      return createSuccessResponse('database', {
        webhookId: record.id,
        duration: Date.now() - startTime,
        record: record.toJSON(),
      });
    } catch (error) {
      const errorResponse = {
        message: error.message,
        details: error.details || {
          name: error.name,
          stack: error.stack, // Optional: might be too verbose but useful
          errors: error.errors, // Common in Sequelize
        },
      };

      return createErrorResponse('database', errorResponse, 'DATABASE_ERROR', {
        webhookId,
      });
    }
  }

  /**
   * Update webhook status after delivery attempt
   *
   * @param {string} webhookId - Webhook ID
   * @param {Object} result - Delivery result
   * @returns {Promise<Object>} Updated record
   */
  async updateStatus(webhookId, result) {
    // Validate input
    const validation = updateStatusSchema.safeParse({ webhookId, result });
    if (!validation.success) {
      throw new Error(
        `Validation error: ${validation.error.flatten().fieldErrors}`,
      );
    }

    const Webhook = this.getModel();
    const validatedResult = validation.data;

    const updates = {
      status: validatedResult.success
        ? WEBHOOK_STATUS.DELIVERED
        : WEBHOOK_STATUS.FAILED,
      attempts: validatedResult.attempts || 1,
    };

    if (validatedResult.success) {
      updates.next_retry_at = null;
    } else if (validatedResult.nextRetryAt) {
      updates.next_retry_at = validatedResult.nextRetryAt;
    }

    const [affectedCount] = await Webhook.update(updates, {
      where: { id: webhookId },
    });

    if (affectedCount === 0) {
      return null;
    }

    return Webhook.findByPk(webhookId);
  }

  /**
   * Get webhooks pending retry
   *
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Webhooks pending retry
   */
  async getPendingRetries(options = {}) {
    const Webhook = this.getModel();

    const limit = options.limit || 100;

    return Webhook.findAll({
      where: {
        status: { [Op.in]: [WEBHOOK_STATUS.PENDING, WEBHOOK_STATUS.FAILED] },
        next_retry_at: { [Op.lte]: new Date() },
        attempts: { [Op.lt]: col('max_retries') },
      },
      order: [['next_retry_at', 'ASC']],
      limit,
    });
  }

  /**
   * Get webhook by ID
   *
   * @param {string} webhookId - Webhook ID
   * @returns {Promise<Object|null>} Webhook record or null
   */
  async getById(webhookId) {
    const Webhook = this.getModel();
    return Webhook.findByPk(webhookId);
  }

  /**
   * Get webhooks with filters
   *
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Paginated results
   */
  async getWebhooks(options = {}) {
    // Validate input
    const validation = getWebhooksSchema.safeParse(options);
    if (!validation.success) {
      throw new Error(
        `Validation error: ${JSON.stringify(validation.error.flatten().fieldErrors)}`,
      );
    }

    const validatedResult = validation.data;
    const Webhook = this.getModel();

    const where = {};
    const { limit, offset, search } = validatedResult;

    if (search) {
      where[Op.or] = [
        { event: { [Op.like]: `%${search}%` } },
        { metadata: { [Op.like]: `%${search}%` } },
      ];
    }

    if (validatedResult.status) {
      where.status = validatedResult.status;
    }

    if (validatedResult.event) {
      where.event = validatedResult.event;
    }

    if (validatedResult.fromDate) {
      where.created_at = { [Op.gte]: validatedResult.fromDate };
    }

    if (validatedResult.toDate) {
      where.created_at = {
        ...where.created_at,
        [Op.lte]: validatedResult.toDate,
      };
    }

    const { count, rows } = await Webhook.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit,
      offset,
    });

    return {
      data: rows,
      total: count,
      limit,
      offset,
      hasMore: offset + rows.length < count,
    };
  }

  /**
   * Get adapter statistics
   *
   * @returns {Promise<Object>} Stats
   */
  async getStats() {
    const Webhook = this.getModel();

    const stats = await Webhook.findAll({
      attributes: ['status', [fn('COUNT', col('id')), 'count']],
      group: ['status'],
      raw: true,
    });

    const result = {
      adapter: 'database',
      total: 0,
      pending: 0,
      delivered: 0,
      failed: 0,
    };

    stats.forEach(stat => {
      result[stat.status] = parseInt(stat.count, 10);
      result.total += parseInt(stat.count, 10);
    });

    return result;
  }

  /**
   * Delete old webhooks (cleanup)
   *
   * @param {Object} options - Cleanup options
   * @returns {Promise<number>} Number of deleted records
   */
  async cleanup(options = {}) {
    // Validate input
    const validation = cleanupSchema.safeParse(options);
    if (!validation.success) {
      throw new Error(
        `Validation error: ${JSON.stringify(validation.error.flatten().fieldErrors)}`,
      );
    }

    const validatedResult = validation.data;
    const Webhook = this.getModel();

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - validatedResult.olderThan);

    const where = {
      created_at: { [Op.lt]: cutoffDate },
    };

    // Only delete delivered webhooks by default
    if (!validatedResult.includeAll) {
      where.status = WEBHOOK_STATUS.DELIVERED;
    }

    const deleted = await Webhook.destroy({ where });
    return deleted;
  }
}
