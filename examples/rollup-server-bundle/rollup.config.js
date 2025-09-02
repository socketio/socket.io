import resolve from "@rollup/plugin-node-resolve";
import json from "@rollup/plugin-json";

export default {
  input: "index.js",
  output: {
    file: "bundle.js",
    format: "esm",
  },
  plugins: [resolve(), json({ compact: true })],
};
