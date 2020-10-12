const { BannerPlugin } = require("webpack");
const version = require("../package.json").version;

const banner = `Socket.IO v${version}
(c) 2014-${new Date().getFullYear()} Guillermo Rauch
Released under the MIT License.`;

module.exports = {
  entry: "./build/index.js",
  output: {
    filename: "socket.io.js",
    library: "io",
    libraryTarget: "umd",
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
    })()`,
  },
  mode: "development",
  devtool: "source-map",
  node: {
    Buffer: false,
  },
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
