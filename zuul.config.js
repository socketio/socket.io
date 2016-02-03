
module.exports = {
  ui: 'mocha-bdd',
  server: './test/support/server.js',
  tunnel: {
    type: 'ngrok',
    authtoken: '6Aw8vTgcG5EvXdQywVvbh_3fMxvd4Q7dcL2caAHAFjV',
    proto: 'tcp'
  },
  builder: 'zuul-builder-webpack',
  webpack: {
    output: {
      filename: "engine.io.js",
      library: "eio",
      libraryTarget: "umd"
    },
    externals: {
      global: glob()
    },
    module: {
      loaders: [{
        test: /\.(js|jsx)?$/,
        exclude: /(node_modules|bower_components)/,
        loader: 'babel', // 'babel-loader' is also a legal name to reference
        query: {
          presets: ['react', 'es2015']
        }
      }]
    }
  }
};

/**
 * Populates `global`.
 *
 * @api private
 */

function glob(){
  return 'typeof self !== "undefined" ? self : '
    + 'typeof window !== "undefined" ? window : '
    + 'typeof global !== "undefined" ? global : {}';
}
