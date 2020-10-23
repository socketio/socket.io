const { NormalModuleReplacementPlugin } = require("webpack");
const config = require("./prod.config");

module.exports = {
  ...config,
  output: {
    ...config.output,
    filename: "socket.io.msgpack.min.js",
  },
  plugins: [
    ...config.plugins,
    new NormalModuleReplacementPlugin(
      /^socket.io-parser$/,
      "socket.io-msgpack-parser"
    ),
  ],
};
