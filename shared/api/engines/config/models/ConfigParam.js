/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { DataTypes, Model } from 'sequelize';

export default class ConfigParam extends Model {
  static initSchema(sequelize) {
    // Only init once
    if (this.sequelize) return;

    this.init(
      {
        namespace: {
          type: DataTypes.STRING,
          allowNull: false,
          primaryKey: true,
        },
        key: { type: DataTypes.STRING, allowNull: false, primaryKey: true },
        value: { type: DataTypes.JSON, allowNull: false },
      },
      {
        sequelize,
        tableName: 'configs',
        timestamps: true,
      },
    );
  }
}
