const { nodeResolve } = require("@rollup/plugin-node-resolve");
const commonjs = require("@rollup/plugin-commonjs");
const { terser } = require("rollup-plugin-terser");

const version = require("../package.json").version;
const banner = `/*!
 * Socket.IO v${version}
 * (c) 2014-${new Date().getFullYear()} Guillermo Rauch
 * Released under the MIT License.
 */`;

module.exports = {
  input: "./build/esm/index.js",
  output: {
    file: "./dist/socket.io.esm.min.js",
    format: "esm",
    sourcemap: true,
    plugins: [terser()],
    banner,
  },
  plugins: [
    nodeResolve({
      browser: true,
    }),
    commonjs(),
  ],
};
