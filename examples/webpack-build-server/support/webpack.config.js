
module.exports = {
  entry: './lib/index.js',
  target: 'node',
  output: {
    path: './dist',
    filename: 'server.js'
  },
  module: {
    loaders: [
      {
        test: /(\.md|\.map)$/,
        loader: 'null'
      },
      {
        test: /\.json$/,
        loader: 'json'
      },
      {
        test: /\.js$/,
        loader: "transform-loader?brfs"
      }
    ]
  }
};
