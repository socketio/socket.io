import Launcher from "@wdio/cli";
import { createServer } from "./support/server";

const launcher = new Launcher("./wdio.conf.js");

async function run() {
  const server = createServer();

  try {
    const exitCode = await launcher.run();
    server.close();
    process.exit(exitCode);
  } catch (e) {
    console.error("Launcher failed to start the test", e.stacktrace);
    process.exit(1);
  }
}

run();
