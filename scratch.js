const webpack = require('webpack');
const compiler = webpack([{ entry: './index.js' }, { entry: './index.js' }]);
compiler.watch({}, (err, stats) => {
  console.log('onBuild called');
  setTimeout(() => process.exit(0), 1000);
});
