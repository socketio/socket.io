import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { Server } from "socket.io";

function initServer(port) {
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
    cors: {
      origin: [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
      ],
    },
    // TODO use an adapter to broadcast messages between the Socket.IO servers
  });

  io.on("connection", (socket) => {
    console.log(`connect ${socket.id}`);

    socket.conn.on("upgrade", (transport) => {
      console.log(`transport upgraded to ${transport.name}`);
    });

    socket.on("disconnect", (reason) => {
      console.log(`disconnect ${socket.id} due to ${reason}`);
    });
  });

  httpServer.listen(port, () => {
    console.log(`server listening at http://localhost:${port}`);
  });
}

initServer(3000);
initServer(3001);
initServer(3002);
