import { Server, Socket } from "socket.io";

const io = new Server(8080);

io.on("connect", (socket: Socket) => {
    console.log(`connect ${socket.id}`);

    socket.on("ping", (cb) => {
        console.log("ping");
        cb();
    });

    socket.on("disconnect", () => {
        console.log(`disconnect ${socket.id}`);
    });
});
