const { resolve } = require("node:path");
const { readFile } = require("node:fs/promises");
const { gzipSync, brotliCompressSync } = require("node:zlib");

const bundles = [
  {
    name: "UMD bundle",
    path: "dist/engine.io.min.js",
  },
  {
    name: "ESM bundle",
    path: "dist/engine.io.esm.min.js",
  },
];

function format(size) {
  return (size / 1024).toFixed(1);
}

async function main() {
  for (const bundle of bundles) {
    const path = resolve(bundle.path);
    const content = await readFile(path);
    const gzip = gzipSync(content);
    const brotli = brotliCompressSync(content);

    console.log(`${bundle.name}`);
    console.log(`min: ${format(content.length)} KB`);
    console.log(`min+gzip: ${format(gzip.length)} KB`);
    console.log(`min+br: ${format(brotli.length)} KB`);
    console.log();
  }
}

main();
