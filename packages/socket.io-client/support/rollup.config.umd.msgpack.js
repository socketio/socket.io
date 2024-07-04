const base = require("./rollup.config.umd.js");
const alias = require("@rollup/plugin-alias");

module.exports = {
  ...base,
  output: {
    ...base.output[1],
    file: "./dist/socket.io.msgpack.min.js",
  },
  plugins: [
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
