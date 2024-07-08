import { readFileSync } from "node:fs";
import { Http3Server } from "@fails-components/webtransport";
import { Server } from "../../build/engine.io.js";

const key = readFileSync("./key.pem");
const cert = readFileSync("./cert.pem");

const PACKETS_COUNT = 100;
const PACKET_SIZE = 100;

const engine = new Server({
  transports: ["polling", "websocket", "webtransport"],
});

const h3Server = new Http3Server({
  port: 3000,
  host: "0.0.0.0",
  secret: "changeit",
  cert,
  privKey: key,
});

const packets = [];

for (let i = 0; i < PACKETS_COUNT; i++) {
  packets.push("a".repeat(PACKET_SIZE));
}

setInterval(() => {
  Object.keys(engine.clients).forEach((id) => {
    const client = engine.clients[id];
    packets.forEach((packet) => {
      client.send(packet);
    });
  });
}, 10000);

function formatSize(val) {
  return Math.floor(val / 1024);
}

setInterval(() => {
  const mem = process.memoryUsage();
  console.log(
    `${Math.floor(process.uptime())}; ${formatSize(mem.heapUsed)}; ${formatSize(
      mem.heapTotal
    )}`
  );
}, 1000);

h3Server.startServer();

(async () => {
  // const stream = await h3Server.sessionStream("/engine.io/");
  const stream = await h3Server.sessionStream("/engine.io/", {});
  const sessionReader = stream.getReader();

  while (true) {
    const { done, value } = await sessionReader.read();
    if (done) {
      break;
    }
    engine.onWebTransportSession(value);
  }
})();
