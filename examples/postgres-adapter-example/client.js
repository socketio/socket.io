import { io } from "socket.io-client";

const CLIENTS_COUNT = 3;
const PORTS = [3000, 3001, 3002];

for (let i = 0; i < CLIENTS_COUNT; i++) {
  const socket = io(`ws://localhost:${PORTS[i % 3]}`, {
    // transports: ["polling"],
    // transports: ["websocket"],
  });

  socket.on("connect", () => {
    console.log(`connected as ${socket.id}`);
  });

  socket.on("connect_error", () => {
    console.log(`connect_error`);
  });

  socket.on("disconnect", (reason) => {
    console.log(`disconnected due to ${reason}`);
  });

  socket.on("hello", (socketId, pid) => {
    console.log(`received "hello" from ${socketId} (process: ${pid})`);
  });

  setInterval(() => {
    socket.emit("hello");
  }, 2000);
}
