const config = require("./webpack.config");

module.exports = {
  ...config,
  output: {
    ...config.output,
    filename: "engine.io.min.js"
  },
  mode: "production",
  module: {
    rules: [
      ...config.module.rules,
      {
        test: /\.js$/,
        loader: "webpack-remove-debug"
      }
    ]
  }
};
