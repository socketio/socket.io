const roomService = require("../src/realtime/services/roomService");

describe("Realtime notification system", () => {
  beforeEach(() => {
    roomService.rooms = new Map();
  });

  test("join room should add user", () => {
    const socket = {
      id: "socket-1",
      join: jest.fn(),
    };

    roomService.joinRoom(socket, "room-a", "user-1");

    const members = roomService.getRoomMembers("room-a");

    expect(socket.join).toHaveBeenCalledWith("room-a");
    expect(members.length).toBe(1);
  });

  test("remove socket should clean room", () => {
    const socket = {
      id: "socket-2",
      join: jest.fn(),
    };

    roomService.joinRoom(socket, "room-b", "user-2");
    roomService.removeSocket("socket-2");

    const members = roomService.getRoomMembers("room-b");

    expect(members.length).toBe(0);
  });
});
