const roomService = require("../services/roomService");
const notificationService = require("../services/notificationService");

function registerConnectionHandler(io) {
  io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.on("join-room", ({ roomId, userId }) => {
      if (!roomId || !userId) {
        socket.emit("event-error", {
          message: "roomId and userId are required",
        });
        return;
      }

      roomService.joinRoom(socket, roomId, userId);

      socket.emit("room-joined", {
        roomId,
        userId,
        socketId: socket.id,
      });
    });

    socket.on("broadcast-notification", ({ roomId, message }) => {
      if (!roomId || !message) {
        socket.emit("event-error", {
          message: "roomId and message are required",
        });
        return;
      }

      notificationService.broadcastToRoom(io, roomId, {
        message,
        sender: socket.id,
        timestamp: new Date().toISOString(),
      });
    });

    socket.on("disconnect", () => {
      roomService.removeSocket(socket.id);
      console.log(`Client disconnected: ${socket.id}`);
    });
  });
}

module.exports = registerConnectionHandler;
