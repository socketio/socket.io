const { BannerPlugin } = require("webpack");
const version = require("../package.json").version;

const banner = `Socket.IO v${version}
(c) 2014-${new Date().getFullYear()} Guillermo Rauch
Released under the MIT License.`;

module.exports = {
  entry: "./build/esm/index.js",
  output: {
    filename: "socket.io.js",
    library: "io",
    libraryTarget: "umd",
    globalObject: "self",
  },
  mode: "development",
  devtool: "source-map",
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
