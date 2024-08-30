const { io } = require("socket.io-client");

const socket = io("http://localhost:3000");

exports.registerListeners = function ({ statusSpan, transportSpan }) {
  function onConnect() {
    statusSpan.innerText = "Connected";
    transportSpan.innerText = socket.io.engine.transport.name;
    socket.io.engine.on("upgrade", (transport) => {
      transportSpan.innerText = transport.name;
    });
    console.log(`connect ${socket.id}`);
  }

  if (socket.connected) {
    onConnect();
  }

  socket.on("connect", onConnect);

  socket.on("connect_error", (err) => {
    console.log(`connect_error due to ${err.message}`);
  });

  socket.on("disconnect", (reason) => {
    statusSpan.innerText = "Disconnected";
    transportSpan.innerText = "N/A";
    console.log(`disconnect due to ${reason}`);
  });
}

exports.emit = function (...args) {
  socket.emit(...args);
}
