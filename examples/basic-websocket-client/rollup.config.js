import terser from "@rollup/plugin-terser";

export default {
  input: "./src/index.js",
  output: {
    file: "./bundle/socket.io.min.js",
    format: "esm",
    plugins: [terser()],
  }
};
