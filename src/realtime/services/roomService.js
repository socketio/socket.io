class RoomService {
  constructor() {
    this.rooms = new Map();
  }

  joinRoom(socket, roomId, userId) {
    socket.join(roomId);

    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Map());
    }

    this.rooms.get(roomId).set(socket.id, userId);
  }

  removeSocket(socketId) {
    for (const [roomId, members] of this.rooms.entries()) {
      members.delete(socketId);

      if (members.size === 0) {
        this.rooms.delete(roomId);
      }
    }
  }

  getRoomMembers(roomId) {
    if (!this.rooms.has(roomId)) return [];
    return [...this.rooms.get(roomId).entries()].map(([socketId, userId]) => ({
      socketId,
      userId,
    }));
  }
}

module.exports = new RoomService();
