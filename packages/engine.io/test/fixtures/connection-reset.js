const { listen } = require("../common");
const net = require("node:net");

const engine = listen((port) => {
  const socket = net.connect(port, () => {
    socket.write(
      "GET / HTTP/1.1\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n",
    );
    setTimeout(() => socket.resetAndDestroy(), 10);
  });
});

setTimeout(() => {
  engine.httpServer.close();
  engine.close();
}, 200);
