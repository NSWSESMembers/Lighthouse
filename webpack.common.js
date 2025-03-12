const path = require('path');
const glob = require('glob');

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
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
  },
  plugins: [
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