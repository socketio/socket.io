const roomService = require("../services/roomService");
const notificationService = require("../services/notificationService");

function registerConnectionHandler(io) {
  io.on("connection", (socket) => {
    console.log(`client connected: ${socket.id}`);

    socket.on("join-room", ({ roomId, userId }) => {
      if (!roomId || !userId) {
        socket.emit("notification-error", {
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

    socket.on("broadcast-notification", ({ roomId, message, type }) => {
      if (!roomId || !message) {
        socket.emit("notification-error", {
          message: "roomId and message are required",
        });
        return;
      }

      notificationService.broadcastToRoom(io, roomId, {
        type: type || "info",
        message,
        senderId: socket.id,
        timestamp: new Date().toISOString(),
      });
    });

    socket.on("disconnect", () => {
      roomService.removeSocket(socket.id);
      console.log(`client disconnected: ${socket.id}`);
    });
  });
}

module.exports = registerConnectionHandler;
