import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/cluster-adapter";
import { setupWorker } from "@socket.io/sticky";

const httpServer = createServer((req, res) => {
  if (req.method === "GET" && req.url === "/") {
    const content = readFileSync("./index.html");
    res.writeHead(200, {
      "content-type": "text/html",
    });
    res.write(content);
    res.end();
  } else {
    res.writeHead(404).end();
  }
});

const io = new Server(httpServer, {
  adapter: createAdapter(),
});

setupWorker(io);

io.on("connection", (socket) => {
  console.log(`connect ${socket.id}`);

  socket.emit("nodeId", process.env.NODE_APP_INSTANCE);

  socket.conn.on("upgrade", (transport) => {
    console.log(`transport upgraded to ${transport.name}`);
  });

  socket.on("disconnect", (reason) => {
    console.log(`disconnect ${socket.id} due to ${reason}`);
  });
});

// graceful shutdown
process.on("SIGINT", () => {
  io.close((err) => {
    process.exit(err ? 1 : 0);
  });
});
