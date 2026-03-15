class NotificationService {
  broadcastToRoom(io, roomId, payload) {
    io.to(roomId).emit("receive-notification", payload);
  }

  broadcastToAll(io, payload) {
    io.emit("receive-notification", payload);
  }

  sendToClient(socket, payload) {
    socket.emit("receive-notification", payload);
  }
}

module.exports = new NotificationService();
