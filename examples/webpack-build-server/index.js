const { Server } = require("socket.io");

const clientFile = require("./node_modules/socket.io/client-dist/socket.io.min?raw");
const clientMap = require("./node_modules/socket.io/client-dist/socket.io.min.js.map?raw");

Server.sendFile = (filename, req, res) => {
  res.end(filename.endsWith(".map") ? clientMap : clientFile);
};

const io = new Server();

io.on("connection", socket => {
  console.log(`connect ${socket.id}`);

  socket.on("disconnect", (reason) => {
    console.log(`disconnect ${socket.id} due to ${reason}`);
  });
});

io.listen(3000);
