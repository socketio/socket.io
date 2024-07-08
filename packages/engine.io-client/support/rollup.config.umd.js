const { nodeResolve } = require("@rollup/plugin-node-resolve");
const { babel } = require("@rollup/plugin-babel");
const { terser } = require("rollup-plugin-terser");
const commonjs = require("@rollup/plugin-commonjs");

const version = require("../package.json").version;
const banner = `/*!
 * Engine.IO v${version}
 * (c) 2014-${new Date().getFullYear()} Guillermo Rauch
 * Released under the MIT License.
 */`;

module.exports = [
  {
    input: "./build/esm-debug/browser-entrypoint.js",
    output: {
      file: "./dist/engine.io.js",
      format: "umd",
      name: "eio",
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
  },
  {
    input: "./build/esm/browser-entrypoint.js",
    output: {
      file: "./dist/engine.io.min.js",
      format: "umd",
      name: "eio",
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
  },
];
