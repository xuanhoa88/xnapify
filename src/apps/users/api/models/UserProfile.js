/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * UserProfile Model Factory
 *
 * Creates the UserProfile model with the provided Sequelize instance.
 * Stores additional user profile attributes as EAV (Entity-Attribute-Value) rows.
 * One-to-Many relationship with User model (one user has many attribute rows).
 *
 * @param {Object} connection - Sequelize connection instance
 * @returns {Model} UserProfile model
 */
export default function createUserProfileModel({ connection, DataTypes }) {
  const UserProfile = connection.define(
    'UserProfile',
    {
      user_id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: 'User this profile belongs to',
      },

      attribute_key: {
        type: DataTypes.STRING(255),
        primaryKey: true,
        allowNull: false,
        comment: 'Attribute key/name',
      },

      attribute_value: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Attribute value stored as text',
        get() {
          const rawValue = this.getDataValue('attribute_value');
          if (rawValue === undefined || rawValue === null) return rawValue;

          const type = this.getDataValue('attribute_type');
          switch (type) {
            case 'json':
              try {
                return JSON.parse(rawValue);
              } catch {
                return rawValue; // fallback on parse error
              }
            case 'number':
              return Number(rawValue);
            case 'boolean':
              return rawValue === 'true';
            case 'date':
              return new Date(rawValue);
            default:
              return rawValue; // string or unknown
          }
        },
        set(value) {
          if (value === null || value === undefined) {
            this.setDataValue('attribute_type', 'string');
            this.setDataValue('attribute_value', null);
          } else if (value instanceof Date) {
            this.setDataValue('attribute_type', 'date');
            this.setDataValue('attribute_value', value.toISOString());
          } else if (typeof value === 'object' && value !== null) {
            this.setDataValue('attribute_type', 'json');
            this.setDataValue('attribute_value', JSON.stringify(value));
          } else if (typeof value === 'boolean') {
            this.setDataValue('attribute_type', 'boolean');
            this.setDataValue('attribute_value', String(value));
          } else if (typeof value === 'number') {
            this.setDataValue('attribute_type', 'number');
            this.setDataValue('attribute_value', String(value));
          } else {
            this.setDataValue('attribute_type', 'string');
            this.setDataValue('attribute_value', String(value));
          }
        },
      },

      attribute_type: {
        type: DataTypes.ENUM('string', 'number', 'boolean', 'json', 'date'),
        allowNull: false,
        defaultValue: 'string',
        comment: 'Data type for casting attribute_value',
      },
    },
    {
      tableName: 'user_profiles',
      timestamps: true,
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  );

  UserProfile.associate = models => {
    UserProfile.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
    });
  };

  return UserProfile;
}
