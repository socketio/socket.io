const { Server } = require("socket.io");
const registerConnectionHandler = require("./events/connection");

function initSocketServer(server) {
  const io = new Server(server, {
    cors: {
      origin: "*",
    },
  });

  registerConnectionHandler(io);

  return io;
}

module.exports = { initSocketServer };
