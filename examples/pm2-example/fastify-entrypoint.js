import Fastify from "fastify";
import staticPlugin from "@fastify/static";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/cluster-adapter";
import { setupWorker } from "@socket.io/sticky";

const fastify = Fastify();

fastify.register(staticPlugin, {
  root: import.meta.dirname,
});

fastify.get("/", (req, reply) => {
  reply.sendFile("index.html");
});

const io = new Server(fastify.server, {
  adapter: createAdapter(),
});

setupWorker(io);

io.on("connection", (socket) => {
  console.log(`connect ${socket.id}`);

  socket.emit("nodeId", process.env.NODE_APP_INSTANCE ?? "N/A");

  socket.conn.on("upgrade", (transport) => {
    console.log(`transport upgraded to ${transport.name}`);
  });

  socket.on("disconnect", (reason) => {
    console.log(`disconnect ${socket.id} due to ${reason}`);
  });
});

fastify.addHook("preClose", (done) => {
  // close all active connections on this server
  io.local.disconnectSockets(true);
  done();
});

fastify.ready(() => {
  console.log("successfully booted!");
});

// graceful shutdown
process.on("SIGINT", () => {
  fastify.close((err) => {
    process.exit(err ? 1 : 0);
  });
});
