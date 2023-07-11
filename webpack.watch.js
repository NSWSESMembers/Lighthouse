const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');
const WebpackExtensionManifestPlugin = require('webpack-extension-manifest-plugin');
const moment = require('moment');

const packageName = "Lighthouse Development Preview"
const now = new moment();
const versionString = now.format('YYYY.MM.DD.HHmmSS')


module.exports = merge(common, {
  mode: 'development',
  devtool: 'inline-source-map',
  devServer: {
    static: './dist',
  },
  plugins: [
    new WebpackExtensionManifestPlugin({
      config: {
        base: './static/manifest.json',
        extend: {
          version: versionString,
          name: packageName,
          short_name: packageName,
          browser_action : {
            default_icon : {
              16 : "icons/lighthouse64_dev.png"
            }
          },
          icons: {
            128: "icons/lighthouse128_dev.png",
            64: "icons/lighthouse64_dev.png"
          },
        },
      },
    }),
  ]
});