import { io, type Socket } from "socket.io-client";

interface ServerToClientEvents {
    hello: (val: string) => void;
}

interface ClientToServerEvents {
    ping: (cb: () => void) => void;
}

const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io("ws://localhost:8080/");

socket.on("connect", () => {
    console.log(`connect ${socket.id}`);
});

socket.on("hello", (val) => {
   console.log(`got ${val}`);
});

socket.on("disconnect", () => {
    console.log(`disconnect`);
});

setInterval(() => {
    const start = Date.now();
    socket.emit("ping", () => {
        console.log(`pong (latency: ${Date.now() - start} ms)`);
    });
}, 1000);
