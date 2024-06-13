import { createServer } from "node:http";
import { Server } from "../../build/engine.io.js";

const EMIT_INTERVAL_MS = 10_000;
const PACKETS_COUNT = 100;
const PACKET_SIZE = 100;

const httpServer = createServer();
const engine = new Server();

engine.attach(httpServer);

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
}, EMIT_INTERVAL_MS);

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

httpServer.listen(3000);
