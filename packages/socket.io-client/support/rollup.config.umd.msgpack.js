const base = require("./rollup.config.umd.js")[1];
const alias = require("@rollup/plugin-alias");
const commonjs = require("@rollup/plugin-commonjs");

module.exports = {
  ...base,
  output: {
    ...base.output,
    file: "./dist/socket.io.msgpack.min.js",
  },
  plugins: [
    commonjs(),
    alias({
      entries: [
        {
          find: "socket.io-parser",
          replacement: "socket.io-msgpack-parser",
        },
      ],
    }),
    ...base.plugins,
  ],
};
