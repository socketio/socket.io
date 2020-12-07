const eioc = require("engine.io-client");
const listen = require("../common").listen;

const engine = listen(port => {
  const socket = new eioc.Socket("ws://localhost:" + port);
  socket.on("upgrading", () => {
    engine.httpServer.close();
    engine.close();
  });
});
