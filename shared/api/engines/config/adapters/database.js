/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import ConfigParam from '../models/ConfigParam';

import BaseAdapter from './base';

export default class DbAdapter extends BaseAdapter {
  constructor(sequelize) {
    super();
    if (sequelize) {
      ConfigParam.initSchema(sequelize);
    } // else we expect it to be initialized elsewhere
  }

  async set(namespace, key, value) {
    await ConfigParam.upsert({
      namespace,
      key,
      value,
    });
  }

  async get(namespace, key) {
    const record = await ConfigParam.findOne({
      where: { namespace, key },
    });
    return record ? record.value : undefined;
  }

  async delete(namespace, key) {
    const whereClause = key == null ? { namespace } : { namespace, key };
    await ConfigParam.destroy({
      where: whereClause,
    });
  }
}
