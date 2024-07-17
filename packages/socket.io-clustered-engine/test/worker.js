const { createServer } = require("node:http");
const { NodeClusterEngine } = require("../dist/cluster");

const httpServer = createServer();
const engine = new NodeClusterEngine({
  pingInterval: 50
});

engine.on("connection", socket => {
  socket.on("message", (val) => {
    socket.send(val);
  });
});

engine.attach(httpServer);
httpServer.listen(3000);
