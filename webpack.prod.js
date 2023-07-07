const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');
const ZipPlugin = require('zip-webpack-plugin');
const manifest = require('./static/manifest.json');

module.exports = merge(common, {
  mode: 'production',
  devtool: 'source-map',
  plugins: [
    new ZipPlugin({
      path: '../build/',
      filename: `${manifest.name} ${manifest.version}.zip`,
    })
  ]
});