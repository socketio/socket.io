const io = require("../..");
const socket = io("http://localhost:3210", {
  autoUnref: true,
  transports: ["websocket"],
});

socket.on("open", () => {
  console.log("open");
});

setTimeout(() => {
  console.log("process should exit now");
}, 500);
