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

/**
 * Zod Validation Schemas for Database Adapter
 */

// Send webhook input schema
const sendInputSchema = z.object({
  payload: z
    .object({
      url: z.string().min(1).max(2048).url(),
    })
    .passthrough(),
  options: z
    .object({
      event: z.string().max(1024).optional(),
      retries: z.number().int().min(0).max(10).optional(),
      secret: z.string().optional(),
      headers: z.record(z.string()).optional(),
      metadata: z.record(z.any()).optional(),
    })
    .optional()
    .default({}),
});

// Update status input schema
const updateStatusSchema = z.object({
  webhookId: z.string().uuid(),
  result: z.object({
    success: z.boolean(),
    statusCode: z.number().int().optional(),
    responseBody: z.any().optional(),
    error: z
      .object({
        message: z.string().optional(),
        code: z.string().optional(),
      })
      .optional(),
    attempts: z.number().int().min(1).optional(),
    duration: z.number().int().optional(),
    nextRetryAt: z.date().optional(),
  }),
});

// Get webhooks query schema
const getWebhooksSchema = z.object({
  status: z.enum(['pending', 'processing', 'delivered', 'failed']).optional(),
  event: z.string().max(1024).optional(),
  url: z.string().max(2048).optional(),
  fromDate: z.date().optional(),
  toDate: z.date().optional(),
  limit: z.number().int().min(1).max(100).optional().default(20),
  offset: z.number().int().min(0).optional().default(0),
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
function defineModel(db) {
  return db.define(
    'Webhook',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      url: {
        type: DataTypes.STRING(2048),
        allowNull: false,
      },
      payload: {
        type: DataTypes.TEXT,
        allowNull: true,
        get() {
          const value = this.getDataValue('payload');
          return value ? JSON.parse(value) : null;
        },
        set(value) {
          this.setDataValue('payload', value ? JSON.stringify(value) : null);
        },
      },
      event: {
        type: DataTypes.STRING(128),
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM('pending', 'processing', 'delivered', 'failed'),
        defaultValue: 'pending',
      },
      statusCode: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'status_code',
      },
      responseBody: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'response_body',
        get() {
          const value = this.getDataValue('responseBody');
          if (!value) return null;
          try {
            return JSON.parse(value);
          } catch {
            return value;
          }
        },
        set(value) {
          this.setDataValue(
            'responseBody',
            typeof value === 'object' ? JSON.stringify(value) : value,
          );
        },
      },
      errorMessage: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'error_message',
      },
      errorCode: {
        type: DataTypes.STRING(64),
        allowNull: true,
        field: 'error_code',
      },
      attempts: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      maxRetries: {
        type: DataTypes.INTEGER,
        defaultValue: 3,
        field: 'max_retries',
      },
      nextRetryAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'next_retry_at',
      },
      durationMs: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'duration_ms',
      },
      hasSignature: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'has_signature',
      },
      headers: {
        type: DataTypes.TEXT,
        allowNull: true,
        get() {
          const value = this.getDataValue('headers');
          return value ? JSON.parse(value) : null;
        },
        set(value) {
          this.setDataValue('headers', value ? JSON.stringify(value) : null);
        },
      },
      metadata: {
        type: DataTypes.TEXT,
        allowNull: true,
        get() {
          const value = this.getDataValue('metadata');
          return value ? JSON.parse(value) : null;
        },
        set(value) {
          this.setDataValue('metadata', value ? JSON.stringify(value) : null);
        },
      },
      deliveredAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'delivered_at',
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
    return this._connection !== null || this._connection !== undefined;
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
    const db = this.getDb();
    return db.models.Webhook || defineModel(db);
  }

  /**
   * Send a webhook (stores in database)
   * Note: This adapter only stores the webhook, actual HTTP delivery
   * should be handled by the HTTP adapter or worker
   *
   * @param {Object} payload - Payload (must include url property)
   * @param {string} payload.url - Webhook URL
   * @param {Object} options - Options
   * @returns {Promise<Object>} Result with webhook record
   */
  async send(payload, options = {}) {
    // Validate input
    const validation = sendInputSchema.safeParse({ payload, options });
    if (!validation.success) {
      return {
        success: false,
        status: WEBHOOK_STATUS.FAILED,
        error: {
          message: validation.error.message,
          code: 'VALIDATION_ERROR',
          details: validation.error.flatten(),
        },
        timestamp: new Date().toISOString(),
        adapter: 'database',
      };
    }

    const { options: validatedOptions } = validation.data;
    // Extract url from payload, rest becomes stored data
    const { url, ...data } = payload;
    const startTime = Date.now();
    const webhookId = uuidv4();

    try {
      const Webhook = this.getModel();

      const record = await Webhook.create({
        id: webhookId,
        url,
        payload: data,
        event: validatedOptions.event || null,
        status: WEBHOOK_STATUS.PENDING,
        maxRetries: validatedOptions.retries || 3,
        hasSignature: Boolean(validatedOptions.secret),
        headers: validatedOptions.headers || null,
        metadata: validatedOptions.metadata || null,
      });

      return {
        success: true,
        status: WEBHOOK_STATUS.PENDING,
        webhookId: record.id,
        url,
        timestamp: record.createdAt.toISOString(),
        duration: Date.now() - startTime,
        adapter: 'database',
        record: record.toJSON(),
      };
    } catch (error) {
      return {
        success: false,
        status: WEBHOOK_STATUS.FAILED,
        webhookId,
        url,
        error: {
          message: error.message,
          code: 'DATABASE_ERROR',
        },
        timestamp: new Date().toISOString(),
        adapter: 'database',
      };
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
    const { result: validatedResult } = validation.data;

    const updates = {
      status: validatedResult.success
        ? WEBHOOK_STATUS.DELIVERED
        : WEBHOOK_STATUS.FAILED,
      statusCode: validatedResult.statusCode || null,
      responseBody: validatedResult.responseBody || null,
      errorMessage:
        (validatedResult.error && validatedResult.error.message) || null,
      errorCode: (validatedResult.error && validatedResult.error.code) || null,
      attempts: validatedResult.attempts || 1,
      durationMs: validatedResult.duration || null,
    };

    if (validatedResult.success) {
      updates.deliveredAt = new Date();
      updates.nextRetryAt = null;
    } else if (validatedResult.nextRetryAt) {
      updates.nextRetryAt = validatedResult.nextRetryAt;
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
        nextRetryAt: { [Op.lte]: new Date() },
        attempts: { [Op.lt]: col('max_retries') },
      },
      order: [['nextRetryAt', 'ASC']],
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

    const validatedOptions = validation.data;
    const Webhook = this.getModel();

    const where = {};
    const { limit, offset } = validatedOptions;

    if (validatedOptions.status) {
      where.status = validatedOptions.status;
    }

    if (validatedOptions.event) {
      where.event = validatedOptions.event;
    }

    if (validatedOptions.url) {
      where.url = { [Op.like]: `%${validatedOptions.url}%` };
    }

    if (validatedOptions.fromDate) {
      where.createdAt = { [Op.gte]: validatedOptions.fromDate };
    }

    if (validatedOptions.toDate) {
      where.createdAt = {
        ...where.createdAt,
        [Op.lte]: validatedOptions.toDate,
      };
    }

    const { count, rows } = await Webhook.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
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
      processing: 0,
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

    const validatedOptions = validation.data;
    const Webhook = this.getModel();

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - validatedOptions.olderThan);

    const where = {
      createdAt: { [Op.lt]: cutoffDate },
    };

    // Only delete delivered webhooks by default
    if (!validatedOptions.includeAll) {
      where.status = WEBHOOK_STATUS.DELIVERED;
    }

    const deleted = await Webhook.destroy({ where });
    return deleted;
  }
}
