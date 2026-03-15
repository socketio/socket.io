const roomService = require("../src/realtime/services/roomService");

describe("Realtime notification system", () => {
  beforeEach(() => {
    roomService.rooms = new Map();
  });

  it("should allow client to join room", () => {
    const mockSocket = {
      id: "socket-1",
      join: jest.fn(),
    };

    roomService.joinRoom(mockSocket, "room-a", "user-1");

    const members = roomService.getRoomMembers("room-a");

    expect(mockSocket.join).toHaveBeenCalledWith("room-a");
    expect(members).toHaveLength(1);
    expect(members[0]).toEqual({
      socketId: "socket-1",
      userId: "user-1",
    });
  });

  it("should clean up room members on disconnect", () => {
    const mockSocket = {
      id: "socket-2",
      join: jest.fn(),
    };

    roomService.joinRoom(mockSocket, "room-b", "user-2");
    roomService.removeSocket("socket-2");

    const members = roomService.getRoomMembers("room-b");
    expect(members).toHaveLength(0);
  });
});
