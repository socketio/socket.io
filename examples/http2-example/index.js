import { readFileSync } from "node:fs";
import { createSecureServer } from "node:http2";
import { Server } from "socket.io";

const key = readFileSync("./key.pem");
const cert = readFileSync("./cert.pem");

const httpServer = createSecureServer(
  {
    key,
    cert,
    allowHTTP1: true,
  },
  (req, res) => {
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
  },
);

const io = new Server(httpServer);

io.on("connection", (socket) => {
  console.log(`connect ${socket.id}`);

  socket.conn.on("upgrade", (transport) => {
    console.log(`transport upgraded to ${transport.name}`);
  });

  socket.on("disconnect", (reason) => {
    console.log(`disconnect ${socket.id} due to ${reason}`);
  });
});

const port = process.env.PORT || 3000;

httpServer.listen(port, () => {
  console.log(`server listening at https://localhost:${port}`);
});
