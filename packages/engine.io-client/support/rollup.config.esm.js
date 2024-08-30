const { nodeResolve } = require("@rollup/plugin-node-resolve");
const { terser } = require("rollup-plugin-terser");

const version = require("../package.json").version;
const banner = `/*!
 * Engine.IO v${version}
 * (c) 2014-${new Date().getFullYear()} Guillermo Rauch
 * Released under the MIT License.
 */`;

module.exports = {
  input: "./build/esm/index.js",
  output: {
    file: "./dist/engine.io.esm.min.js",
    format: "esm",
    sourcemap: true,
    plugins: [
      terser({
        mangle: {
          properties: {
            regex: /^_/,
          },
        },
      }),
    ],
    banner,
  },
  plugins: [
    nodeResolve({
      browser: true,
    }),
  ],
};
