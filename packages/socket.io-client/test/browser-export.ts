import { existsSync, readFileSync } from "fs";
import { createRequire } from "module";
import { join } from "path";
import expect = require("expect.js");

// the "socket.io-client/browser" subpath export allows importing the
// standalone ESM bundle directly (for example with Deno or in the browser),
// without a bundler and without copying the bundle locally
// see https://github.com/socketio/socket.io/issues/5383
describe("browser export", () => {
  const packageRoot = join(__dirname, "..");
  const pkg = JSON.parse(
    readFileSync(join(packageRoot, "package.json"), "utf8"),
  );

  it("should declare a ./browser subpath export", () => {
    expect(pkg.exports["./browser"]).to.eql({
      types: "./build/esm/index.d.ts",
      default: "./dist/socket.io.esm.min.js",
    });
  });

  it("should point to files that exist", () => {
    const entry = pkg.exports["./browser"];
    expect(existsSync(join(packageRoot, entry.default))).to.be(true);
    expect(existsSync(join(packageRoot, entry.types))).to.be(true);
  });

  it("should be resolvable by its package name", () => {
    const require = createRequire(join(packageRoot, "index.js"));
    const resolved = require.resolve("socket.io-client/browser");
    expect(resolved).to.be(join(packageRoot, "dist", "socket.io.esm.min.js"));
  });
});
