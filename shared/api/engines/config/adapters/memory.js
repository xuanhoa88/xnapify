/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import BaseAdapter from './base';

export default class MemoryAdapter extends BaseAdapter {
  constructor() {
    super();
    this.store = new Map();
  }

  _getKey(namespace, key) {
    return `${namespace}_${key}`;
  }

  async set(namespace, key, value) {
    // eslint-disable-next-line no-underscore-dangle
    this.store.set(this._getKey(namespace, key), value);
  }

  async get(namespace, key) {
    // eslint-disable-next-line no-underscore-dangle
    return this.store.get(this._getKey(namespace, key));
  }

  async delete(namespace, key) {
    if (key == null) {
      const prefix = `${namespace}_`;
      for (const k of this.store.keys()) {
        if (k.startsWith(prefix)) {
          this.store.delete(k);
        }
      }
    } else {
      // eslint-disable-next-line no-underscore-dangle
      this.store.delete(this._getKey(namespace, key));
    }
  }
}
