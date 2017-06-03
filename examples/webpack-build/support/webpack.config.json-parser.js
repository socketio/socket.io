
var webpack = require('webpack');

module.exports = {
  entry: './lib/index.js',
  output: {
    path: require('path').join(__dirname, '../dist'),
    filename: 'app.json-parser.js'
  },
  // generate sourcemap
  devtool: 'source-map',
  plugins: [
    // replace require('debug')() with an noop function
    new webpack.NormalModuleReplacementPlugin(/debug/, process.cwd() + '/support/noop.js'),
    // replace socket.io-parser with socket.io-json-parser
    new webpack.NormalModuleReplacementPlugin(/socket\.io-parser/, 'socket.io-json-parser'),
    // use uglifyJS (IE9+ support)
    new webpack.optimize.UglifyJsPlugin({
      compress: {
        warnings: false
      }
    })
  ],
  module: {
    loaders: [
      {
        // strip `debug()` calls
        test: /\.js$/,
        loader: 'strip-loader?strip[]=debug'
      }
    ]
  }
};
