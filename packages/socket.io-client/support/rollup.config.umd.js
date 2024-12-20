const { nodeResolve } = require("@rollup/plugin-node-resolve");
const commonjs = require("@rollup/plugin-commonjs");
const { babel } = require("@rollup/plugin-babel");
const { terser } = require("rollup-plugin-terser");

const version = require("../package.json").version;
const banner = `/*!
 * Socket.IO v${version}
 * (c) 2014-${new Date().getFullYear()} Guillermo Rauch
 * Released under the MIT License.
 */`;

const devBundle = {
  input: "./build/esm-debug/browser-entrypoint.js",
  output: {
    file: "./dist/socket.io.js",
    format: "umd",
    name: "io",
    sourcemap: true,
    banner,
  },
  plugins: [
    nodeResolve({
      browser: true,
    }),
    commonjs(),
    babel({
      babelHelpers: "bundled",
      presets: [["@babel/env"]],
      plugins: [
        "@babel/plugin-transform-object-assign",
        [
          "@babel/plugin-transform-classes",
          {
            loose: true,
          },
        ],
      ],
    }),
  ],
};

const prodBundle = {
  input: "./build/esm/browser-entrypoint.js",
  output: {
    file: "./dist/socket.io.min.js",
    format: "umd",
    name: "io",
    sourcemap: true,
    plugins: [
      terser({
        mangle: {
          properties: {
            regex: /^_/,
            reserved: ["_placeholder"],
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
    babel({
      babelHelpers: "bundled",
      presets: [["@babel/env"]],
      plugins: [
        "@babel/plugin-transform-object-assign",
        [
          "@babel/plugin-transform-classes",
          {
            loose: true,
          },
        ],
      ],
    }),
  ],
};

module.exports = [devBundle, prodBundle];
