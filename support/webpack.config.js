var webpack = require('webpack');
var merge = require('webpack-merge');
var baseConfig = require('./webpack.config.dev.js');

module.exports = merge(baseConfig, {
  output: {
    library: 'io',
    libraryTarget: 'umd',
    filename: 'socket.io.js'
  },
  plugins: [
    new webpack.optimize.UglifyJsPlugin({
      compress: {
        screw_ie8: false
      },
      mangle: {
        screw_ie8: false
      },
      output: {
        screw_ie8: false,
        beautify: false
      }
    })
  ]
});
