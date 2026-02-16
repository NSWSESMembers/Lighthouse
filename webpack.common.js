const path = require('path');
const glob = require('glob');
const webpack = require('webpack');

const DotenvPlugin = require('dotenv-webpack');
const ESLintPlugin = require('eslint-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');


const contentScripts = glob.sync('./src/contentscripts/**/*.js')
  .reduce((acc, path) => {
    const entry = path.replace(/src\/(.*)\.js/, '$1');
    acc[entry] = path;
    return acc;
  }, {});

const injectScripts = glob.sync('./src/injectscripts/**/*.js')
  .reduce((acc, path) => {
    const entry = path.replace(/src\/(.*)\.js/, '$1');
    acc[entry] = path;
    return acc;
  }, {});

const pagesScripts = glob.sync('./src/pages/**/*.js')
  .reduce((acc, path) => {
    const entry = path.replace(/src\/pages\/(.*)\.js/, 'pages/$1');
    acc[entry] = path;
    return acc;
  }, {});


const myAvailContentScripts = glob.sync('./src/myAvailability/src/contentscripts/**/*.js')
  .reduce((acc, path) => {
    const entry = path.replace(/src\/myAvailability\/src\/(.*)\.js/, 'myAvailability/$1');
    acc[entry] = path;
    return acc;
  }, {});

const myAvailInjectScripts = glob.sync('./src/myAvailability/src/injectscripts/**/*.js')
  .reduce((acc, path) => {
    const entry = path.replace(/src\/myAvailability\/src\/(.*)\.js/, 'myAvailability/$1');
    acc[entry] = path;
    return acc;
  }, {});

const myAvailPagesScripts = glob.sync('./src/myAvailability/src/pages/*.js')
  .reduce((acc, path) => {
    const entry = path.replace(/src\/myAvailability\/src\/pages\/(.*)\.js/, 'myAvailability/pages/$1');
    acc[entry] = path;
    return acc;
  }, {});

module.exports = {
  entry: {
    background: './src/background.js',
    ...contentScripts,
    ...injectScripts,
    ...pagesScripts,
    ...myAvailContentScripts,
    ...myAvailInjectScripts,
    ...myAvailPagesScripts
  },
  module: {
    rules: [
      {
        test: /\.(js|ts)x?$/,
        use: ['babel-loader'],
        exclude: /node_modules/,
      },
      {
        test: /\.(scss|css)$/,
        use: ['style-loader', 'css-loader', 'sass-loader'],
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      // Force webpack to consume the unbundled lib/ sources of leaflet-geosearch
      // instead of the pre-bundled dist/geosearch.module.js.  The pre-bundle
      // inlines @googlemaps/js-api-loader code (containing the remote URL
      // "https://maps.googleapis.com/maps/api/js") which violates MV3 CSP.
      // Using lib/ lets tree-shaking drop unused providers and lets the
      // NormalModuleReplacementPlugin below intercept the separate
      // @googlemaps/js-api-loader import.
      'leaflet-geosearch/dist/geosearch.css': path.resolve(
        __dirname,
        'node_modules/leaflet-geosearch/dist/geosearch.css'
      ),
      'leaflet-geosearch$': path.resolve(
        __dirname,
        'node_modules/leaflet-geosearch/lib'
      ),
    },
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
  },
  plugins: [
    // leaflet-geosearch optionally depends on @googlemaps/js-api-loader which
    // dynamically injects <script> tags — forbidden under Chrome Extension MV3 CSP.
    // Replace it with an empty module so webpack never bundles it.
    new webpack.NormalModuleReplacementPlugin(
      /@googlemaps\/js-api-loader/,
      path.resolve(__dirname, 'src/lib/noop.js')
    ),
    new DotenvPlugin(),
    new ESLintPlugin({
      extensions: ['js', 'ts'],
      overrideConfigFile: path.resolve(__dirname, '.eslintrc'),
    }),
    new CopyPlugin({
      patterns: [
        { 
          from: 'static',
          globOptions: {
            ignore: ["**/.DS_Store","**/manifest.json"],
          },
        } 
        //TODO glob for myavail static
      ],
    }),
  ],
};