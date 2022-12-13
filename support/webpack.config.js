const { BannerPlugin } = require("webpack");
const version = require("../package.json").version;

const banner = `Engine.IO v${version}
(c) 2014-${new Date().getFullYear()} Guillermo Rauch
Released under the MIT License.`;

module.exports = {
  entry: "./build/esm/index.js",
  output: {
    filename: "engine.io.js",
    library: "eio",
    libraryTarget: "umd",
    globalObject: "self",
  },
  mode: "development",
  node: false,
  module: {
    rules: [
      {
        test: /\.m?js$/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env"],
            plugins: ["@babel/plugin-transform-object-assign"],
          },
        },
      },
    ],
  },
  plugins: [new BannerPlugin(banner)],
};
