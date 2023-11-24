const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');
const ZipPlugin = require('zip-webpack-plugin');
const WebpackExtensionManifestPlugin = require('webpack-extension-manifest-plugin');
const moment = require('moment');

const packageName = "Lighthouse"
const now = new moment();
const versionString = now.utcOffset("+10:00").format('YYYY.M.D.Hm')
const versionStringShort = now.utcOffset("+10:00").format('YYYY.MM.DD')

// get git info from command line
let commitHash = require('child_process')
  .execSync('git rev-parse --short HEAD')
  .toString()
  .trim();
  
module.exports = merge(common, {
  mode: 'production',
  devtool: 'source-map',
  plugins: [
    new WebpackExtensionManifestPlugin({
      config: {
        base: './static/manifest.json',
        extend: {
          version: versionString,
          version_name: `${versionStringShort} build ${commitHash}`,
          name: packageName,
          short_name: packageName,
          action : {
            default_icon : {
              16 : "icons/lighthouse64.png"
            }
          },
          icons: {
            128: "icons/lighthouse128.png",
            64: "icons/lighthouse64.png"
          },
        },
      },
    }),
    new ZipPlugin({
      path: '../build/',
      filename: `${packageName} ${versionString}.zip`,
    })
  ]
});