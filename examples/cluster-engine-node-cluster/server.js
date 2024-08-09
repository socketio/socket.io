import cluster from "node:cluster";
import process from "node:process";
import { availableParallelism } from "node:os";
import {
  setupPrimary as setupPrimaryEngine,
  NodeClusterEngine,
} from "@socket.io/cluster-engine";
import {
  setupPrimary as setupPrimaryAdapter,
  createAdapter,
} from "@socket.io/cluster-adapter";
import { createServer } from "node:http";
import { Server } from "socket.io";

if (cluster.isPrimary) {
  console.log(`Primary ${process.pid} is running`);

  const numCPUs = availableParallelism();

  // fork workers
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  setupPrimaryEngine();
  setupPrimaryAdapter();

  // needed for packets containing Buffer objects (you can ignore it if you only send plaintext objects)
  cluster.setupPrimary({
    serialization: "advanced",
  });

  cluster.on("exit", (worker, code, signal) => {
    console.log(`worker ${worker.process.pid} died`);
  });
} else {
  const httpServer = createServer((req, res) => {
    res.writeHead(404).end();
  });

  const engine = new NodeClusterEngine();

  engine.attach(httpServer, {
    path: "/socket.io/",
  });

  const io = new Server({
    adapter: createAdapter(),
  });

  io.bind(engine);

  io.on("connection", (socket) => {
    socket.on("hello", () => {
      socket.broadcast.emit("hello", socket.id, process.pid);
    });
  });

  // workers will share the same port
  httpServer.listen(3000);

  console.log(`Worker ${process.pid} started`);
}
