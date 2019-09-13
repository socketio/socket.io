
module.exports = {
  entry: './lib/index.js',
  output: {
    filename: 'engine.io.js',
    library: 'eio',
    libraryTarget: 'umd'
  },
  node: {
    Buffer: false
  },
  module: {
    loaders: [{
      test: /\.js$/,
      include: /debug/,
      loader: 'babel', // 'babel-loader' is also a legal name to reference
      query: {
        presets: ['es2015']
      }
    }]
  }
};
