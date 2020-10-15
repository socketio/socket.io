import { Manager } from "socket.io-client";

const manager = new Manager("ws://localhost:8080", {});
const socket = manager.socket("/");

// @ts-ignore
socket.on("connect", () => {
    console.log(`connect ${socket.id}`);
});

// @ts-ignore
socket.on("disconnect", () => {
    console.log(`disconnect`);
});

setInterval(() => {
    const start = Date.now();
    socket.emit("ping", () => {
        console.log(`pong (latency: ${Date.now() - start} ms)`);
    });
}, 1000);
