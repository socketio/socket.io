const { nodeResolve } = require("@rollup/plugin-node-resolve");
const commonjs = require("@rollup/plugin-commonjs");
const { babel } = require("@rollup/plugin-babel");
const { terser } = require("rollup-plugin-terser");

module.exports = {
  input: "./build/esm/browser-entrypoint.js",
  output: [
    {
      file: "./dist/engine.io.js",
      format: "umd",
      name: "eio",
      sourcemap: true
    },
    {
      file: "./dist/engine.io.min.js",
      format: "umd",
      name: "eio",
      sourcemap: true,
      plugins: [terser()]
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
