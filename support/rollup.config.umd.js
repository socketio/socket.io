const { nodeResolve } = require("@rollup/plugin-node-resolve");
const commonjs = require("@rollup/plugin-commonjs");
const { babel } = require("@rollup/plugin-babel");
const { terser } = require("rollup-plugin-terser");

const version = require("../package.json").version;
const banner = `/*!
 * Engine.IO v${version}
 * (c) 2014-${new Date().getFullYear()} Guillermo Rauch
 * Released under the MIT License.
 */`;

module.exports = {
  input: "./build/esm/browser-entrypoint.js",
  output: [
    {
      file: "./dist/engine.io.js",
      format: "umd",
      name: "eio",
      sourcemap: true,
      banner
    },
    {
      file: "./dist/engine.io.min.js",
      format: "umd",
      name: "eio",
      sourcemap: true,
      plugins: [terser()],
      banner
    }
  ],
  plugins: [
    nodeResolve({
      browser: true
    }),
    commonjs(),
    babel({
      babelHelpers: "bundled",
      presets: [["@babel/env"]],
      plugins: ["@babel/plugin-transform-object-assign"]
    })
  ]
};
