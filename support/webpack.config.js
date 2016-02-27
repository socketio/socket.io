
module.exports = {
  entry: './lib/index.js',
  output: {
    library: 'io',
    libraryTarget: 'umd',
    filename: 'socket.io.js'
  },
  externals: {
    global: glob()
  },
  module: {
    loaders: [{
      test: /\.js$/,
      exclude: /(node_modules|bower_components)/,
      loader: 'babel', // 'babel-loader' is also a legal name to reference
      query: {
        presets: ['es2015']
      }
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
