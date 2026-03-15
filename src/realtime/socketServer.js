const { Server } = require("socket.io");
const registerConnectionHandler = require("./events/connection");

function createSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
    },
  });

  registerConnectionHandler(io);

  return io;
}

module.exports = createSocketServer;
