/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Redux Features - Public API
 *
 * Centralized export point for all Redux features.
 * Automatically discovers and loads features via Webpack context.
 */

import { createWebpackContextAdapter } from '@shared/utils/contextAdapter';

const featuresContext = require.context('.', true, /^\.\/[^/]+\/index\.js$/);
const adapter = createWebpackContextAdapter(featuresContext);

const reducers = {};
const features = {};

adapter.files().forEach(file => {
  const featureName = file.split('/')[1];
  const featureModule = adapter.load(file);

  // Store the default export as the feature's reducer
  if (featureModule.default) {
    reducers[featureName] = featureModule.default;
  }

  // Flatten all other exports (actions, selectors) for easy importing
  for (const [key, value] of Object.entries(featureModule)) {
    if (key !== 'default') {
      features[key] = value;
    }
  }
});

// Export reducers map specifically for rootReducer.js
export { reducers };

// Export the flattened actions/selectors as the default object
export default features;
