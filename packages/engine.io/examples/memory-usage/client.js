import { Socket } from "engine.io-client";

const CLIENTS_COUNT = 100;

for (let i = 0; i < CLIENTS_COUNT; i++) {
  const socket = new Socket("ws://localhost:3000", {
    transports: ["websocket"],
  });

  socket.on("open", () => {});

  socket.on("message", () => {});

  socket.on("close", (reason) => {});
}
