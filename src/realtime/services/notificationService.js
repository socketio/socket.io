class NotificationService {
  broadcastToRoom(io, roomId, payload) {
    io.to(roomId).emit("notification-update", payload);
  }

  broadcastToAll(io, payload) {
    io.emit("notification-update", payload);
  }

  sendToClient(socket, payload) {
    socket.emit("notification-update", payload);
  }
}

module.exports = new NotificationService();
