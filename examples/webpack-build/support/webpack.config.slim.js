
var webpack = require('webpack');

module.exports = {
  entry: './lib/index.js',
  output: {
    path: './dist',
    filename: 'app.slim.js'
  },
  externals: {
    // replace JSON polyfill (IE6/IE7) with global JSON object
    json3: 'JSON'
  },
  // generate sourcemap
  devtool: 'source-map',
  plugins: [
    // replace require('debug')() with an noop function
    new webpack.NormalModuleReplacementPlugin(/debug/, process.cwd() + '/support/noop.js'),
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
