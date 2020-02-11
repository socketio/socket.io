
module.exports = {
  entry: './lib/index.js',
  output: {
    filename: 'engine.io.js',
    library: 'eio',
    libraryTarget: 'umd',
    // see https://github.com/webpack/webpack/issues/6525
    globalObject: `(() => {
      if (typeof self !== 'undefined') {
          return self;
      } else if (typeof window !== 'undefined') {
          return window;
      } else if (typeof global !== 'undefined') {
          return global;
      } else {
          return Function('return this')();
      }
    })()`
  },
  mode: 'production',
  node: {
    Buffer: false
  },
  module: {
    rules: [
      {
        test: /\.m?js$/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
            plugins: ["@babel/plugin-transform-object-assign"]
          }
        }
      }
    ]
  }
};
