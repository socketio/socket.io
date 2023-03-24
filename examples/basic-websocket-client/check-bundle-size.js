import { rollup } from "rollup";
import terser from "@rollup/plugin-terser";
import { brotliCompressSync } from "node:zlib";

const rollupBuild = await rollup({
  input: "./src/index.js"
});

const rollupOutput = await rollupBuild.generate({
  format: "esm",
  plugins: [terser()],
});

const bundleAsString = rollupOutput.output[0].code;
const brotliedBundle = brotliCompressSync(Buffer.from(bundleAsString));

console.log(`Bundle size: ${brotliedBundle.length} B`);
