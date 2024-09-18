const { Socket } = require("../..");
const socket = new Socket("http://localhost:3000", {
  autoUnref: true,
  transports: ["polling"],
});

socket.on("open", () => {
  console.log("open");
});

setTimeout(() => {
  console.log("process should exit now");
}, 50);
