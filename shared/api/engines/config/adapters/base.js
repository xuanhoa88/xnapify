/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

export default class BaseAdapter {
  async set(_namespace, _key, _value) {
    const err = new Error('BaseAdapter#set not implemented');
    err.name = 'BaseAdapterError';
    err.code = 'ERR_BASE_ADAPTER_SET';
    throw err;
  }

  async get(_namespace, _key) {
    const err = new Error('BaseAdapter#get not implemented');
    err.name = 'BaseAdapterError';
    err.code = 'ERR_BASE_ADAPTER_GET';
    throw err;
  }

  async delete(_namespace, _key) {
    const err = new Error('BaseAdapter#delete not implemented');
    err.name = 'BaseAdapterError';
    err.code = 'ERR_BASE_ADAPTER_DELETE';
    throw err;
  }
}
