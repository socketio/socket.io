
var webpack = require('webpack');

module.exports = {
  name: 'slim',
  entry: './lib/index.js',
  output: {
    library: 'io',
    libraryTarget: 'umd',
    filename: 'socket.io.slim.js'
  },
  externals: {
    global: glob(),
    json3: 'JSON'
  },
  devtool: 'cheap-module-source-map',
  plugins: [
    new webpack.NormalModuleReplacementPlugin(/debug/, process.cwd() + '/support/noop.js')
  ],
  module: {
    loaders: [{
      test: /\.js$/,
      exclude: /(node_modules|bower_components)/,
      loader: 'babel', // 'babel-loader' is also a legal name to reference
      query: { presets: ['es2015'] }
    }, {
      test: /\json3.js/,
      loader: 'imports?define=>false'
    }, {
      test: /\.js$/,
      loader: 'strip-loader?strip[]=debug'
    }]
  }
};

/**
 * Populates `global`.
 *
 * @api private
 */

function glob () {
  return 'typeof self !== "undefined" ? self : ' +
    'typeof window !== "undefined" ? window : ' +
    'typeof global !== "undefined" ? global : {}';
}
