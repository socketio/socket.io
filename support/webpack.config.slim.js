var webpack = require('webpack');
var merge = require('webpack-merge');
var baseConfig = require('./webpack.config.slim.dev.js');

module.exports = merge(baseConfig, {
  output: {
    library: 'io',
    libraryTarget: 'umd',
    filename: 'socket.io.slim.js'
  },
  plugins: [
    new webpack.optimize.UglifyJsPlugin()
  ]
});
