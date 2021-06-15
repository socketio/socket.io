const path = require("path");

module.exports = {
  entry: "./index.js",
  target: "node",
  mode: "production",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "index.js",
  },
  module: {
    rules: [
      {
        resourceQuery: /raw/,
        type: "asset/source",
      },
    ],
  },
};
