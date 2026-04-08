/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import fs from 'fs/promises';

import BaseAdapter from './base';

export default class FileAdapter extends BaseAdapter {
  constructor(filePath) {
    super();
    this.filePath = filePath;
    this.tmpPath = `${filePath}.tmp`;
    this.cache = new Map();
    this.loaded = false;
    this.writePromise = Promise.resolve();
  }

  _getKey(namespace, key) {
    return `${namespace}_${key}`;
  }

  async _ensureLoaded() {
    if (this.loaded) return;
    try {
      const data = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(data);
      for (const [k, v] of Object.entries(parsed)) {
        this.cache.set(k, v);
      }
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
      // If file doesn't exist, start with empty cache
    }
    this.loaded = true;
  }

  async _flush() {
    const rawData = {};
    for (const [k, v] of this.cache.entries()) {
      rawData[k] = v;
    }
    const jsonString = JSON.stringify(rawData, null, 2);

    // Atomic write-through pattern
    // Write full block to temporary file securely
    await fs.writeFile(this.tmpPath, jsonString, 'utf8');
    // Atomically swap the temporary file over the active config file
    await fs.rename(this.tmpPath, this.filePath);
  }

  async _enqueueWrite() {
    this.writePromise = this.writePromise
      // eslint-disable-next-line no-underscore-dangle
      .then(() => this._flush())
      .catch(err => {
        // Prevent uncaught promise rejections breaking the queue. Handle explicitly.
        console.error('[FileAdapter] Atomic flush failed:', err.message);
      });
    await this.writePromise;
  }

  async set(namespace, key, value) {
    // eslint-disable-next-line no-underscore-dangle
    await this._ensureLoaded();
    // eslint-disable-next-line no-underscore-dangle
    this.cache.set(this._getKey(namespace, key), value);
    // eslint-disable-next-line no-underscore-dangle
    await this._enqueueWrite();
  }

  async get(namespace, key) {
    // eslint-disable-next-line no-underscore-dangle
    await this._ensureLoaded();
    // eslint-disable-next-line no-underscore-dangle
    return this.cache.get(this._getKey(namespace, key));
  }

  async delete(namespace, key) {
    // eslint-disable-next-line no-underscore-dangle
    await this._ensureLoaded();
    if (key == null) {
      const prefix = `${namespace}_`;
      for (const k of this.cache.keys()) {
        if (k.startsWith(prefix)) {
          this.cache.delete(k);
        }
      }
    } else {
      // eslint-disable-next-line no-underscore-dangle
      this.cache.delete(this._getKey(namespace, key));
    }
    // eslint-disable-next-line no-underscore-dangle
    await this._enqueueWrite();
  }
}
