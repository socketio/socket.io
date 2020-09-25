const server = require("http").createServer();
const ioc = require("socket.io-client");
const io = require("../..")(server);

const srv = server.listen(() => {
  const socket = ioc("ws://localhost:" + server.address().port);
  socket.on("connect", () => {
    io.close();
    socket.close();
  });
});
