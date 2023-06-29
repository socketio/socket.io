import { readFileSync } from "node:fs";
import { createServer } from "node:https";
import { Server } from "socket.io";
import { Http3Server } from "@fails-components/webtransport";

const key = readFileSync("./key.pem");
const cert = readFileSync("./cert.pem");

const httpsServer = createServer({
  key,
  cert
}, (req, res) => {
  if (req.method === "GET" && req.url === "/") {
    const content = readFileSync("./index.html");
    res.writeHead(200, {
      "content-type": "text/html"
    });
    res.write(content);
    res.end();
  } else {
    res.writeHead(404).end();
  }
});

const io = new Server(httpsServer, {
  transports: ["polling", "websocket", "webtransport"]
});

const port = process.env.PORT || 3000;

io.on("connection", (socket) => {
  console.log(`connect ${socket.id}`);

  socket.conn.on("upgrade", (transport) => {
    console.log(`transport upgraded to ${transport.name}`);
  });

  socket.on("disconnect", (reason) => {
    console.log(`disconnect ${socket.id} due to ${reason}`);
  });
});

httpsServer.listen(port, () => {
  console.log(`server listening at https://localhost:${port}`);
});

const h3Server = new Http3Server({
  port,
  host: "0.0.0.0",
  secret: "changeit",
  cert,
  privKey: key,
});

(async () => {
  const stream = await h3Server.sessionStream("/socket.io/");
  const sessionReader = stream.getReader();

  while (true) {
    const { done, value } = await sessionReader.read();
    if (done) {
      break;
    }
    io.engine.onWebTransportSession(value);
  }
})();

h3Server.startServer();
