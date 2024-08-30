import { RedisEngine } from "@socket.io/cluster-engine";
import { createServer } from "node:http";
import { createClient } from "redis";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import proxyModule from "http-proxy";

const { createProxyServer } = proxyModule;

async function initServer(port) {
  const httpServer = createServer((req, res) => {
    res.writeHead(404).end();
  });

  const pubClient = createClient();
  const subClient = pubClient.duplicate();

  await Promise.all([pubClient.connect(), subClient.connect()]);

  const engine = new RedisEngine(pubClient, subClient);

  engine.attach(httpServer, {
    path: "/socket.io/",
  });

  const io = new Server({
    adapter: createAdapter(pubClient, subClient),
  });

  io.bind(engine);

  io.on("connection", (socket) => {
    socket.on("hello", () => {
      socket.broadcast.emit("hello", socket.id, port);
    });
  });

  httpServer.listen(port);
}

function initProxy() {
  const proxy = createProxyServer();

  function randomTarget() {
    return [
      "http://localhost:3001",
      "http://localhost:3002",
      "http://localhost:3003",
    ][Math.floor(Math.random() * 3)];
  }

  const httpServer = createServer((req, res) => {
    proxy.web(req, res, { target: randomTarget() });
  });

  httpServer.on("upgrade", function (req, socket, head) {
    proxy.ws(req, socket, head, { target: randomTarget() });
  });

  httpServer.listen(3000);
}

await Promise.all([initServer(3001), initServer(3002), initServer(3003)]);

initProxy();
