const { nodeResolve } = require("@rollup/plugin-node-resolve");
const commonjs = require("@rollup/plugin-commonjs");
const { terser } = require("rollup-plugin-terser");

module.exports = {
  input: "./build/esm/index.js",
  output: {
    file: "./dist/engine.io.esm.min.js",
    format: "esm",
    sourcemap: true,
    plugins: [terser()]
  },
  plugins: [
    nodeResolve({
      browser: true
    }),
    commonjs()
  ]
};
