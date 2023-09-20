import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { Server } from "socket.io";

const httpServer = createServer(async (req, res) => {
  if (req.url !== "/") {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  // reload the file every time
  const content = await readFile("index.html");
  const length = Buffer.byteLength(content);

  res.writeHead(200, {
    "Content-Type": "text/html",
    "Content-Length": length,
  });
  res.end(content);
});

const io = new Server(httpServer, {
  connectionStateRecovery: {
    // the backup duration of the sessions and the packets
    maxDisconnectionDuration: 2 * 60 * 1000,
    // whether to skip middlewares upon successful recovery
    skipMiddlewares: true,
  },
});

io.on("connection", (socket) => {
  console.log(`connect ${socket.id}`);

  if (socket.recovered) {
    console.log("recovered!");
    console.log("socket.rooms:", socket.rooms);
    console.log("socket.data:", socket.data);
  } else {
    console.log("new connection");
    socket.join("sample room");
    socket.data.foo = "bar";
  }

  socket.on("disconnect", (reason) => {
    console.log(`disconnect ${socket.id} due to ${reason}`);
  });
});

setInterval(() => {
  io.emit("ping", new Date().toISOString());
}, 1000);

httpServer.listen(3000);
