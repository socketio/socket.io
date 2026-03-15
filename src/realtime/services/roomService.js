class RoomService {
  constructor() {
    this.rooms = new Map();
  }

  joinRoom(socket, roomId, userId) {
    socket.join(roomId);

    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
    }

    this.rooms.get(roomId).add(
      JSON.stringify({
        socketId: socket.id,
        userId,
      })
    );
  }

  removeSocket(socketId) {
    for (const [roomId, members] of this.rooms.entries()) {
      const filteredMembers = [...members].filter((member) => {
        const parsed = JSON.parse(member);
        return parsed.socketId !== socketId;
      });

      if (filteredMembers.length === 0) {
        this.rooms.delete(roomId);
      } else {
        this.rooms.set(roomId, new Set(filteredMembers));
      }
    }
  }

  getRoomMembers(roomId) {
    if (!this.rooms.has(roomId)) {
      return [];
    }

    return [...this.rooms.get(roomId)].map((member) => JSON.parse(member));
  }
}

module.exports = new RoomService();
