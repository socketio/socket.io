import { io } from "socket.io-client";

const CLIENTS_COUNT = 3;

for (let i = 0; i < CLIENTS_COUNT; i++) {
  const socket = io("ws://localhost:3000/", {
    // transports: ["polling"],
    // transports: ["websocket"],
  });

  socket.on("connect", () => {
    console.log(`connected as ${socket.id}`);
  });

  socket.on("disconnect", (reason) => {
    console.log(`disconnected due to ${reason}`);
  });

  socket.on("hello", (socketId, workerId) => {
    console.log(`received "hello" from ${socketId} (worker: ${workerId})`);
  });

  setInterval(() => {
    socket.emit("hello");
  }, 2000);
}
