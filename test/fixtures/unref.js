const eio = require("../..");
const socket = eio("http://localhost:3000", {
  autoUnref: true
});

socket.on("open", () => {
  console.log("open");
});

setTimeout(() => {
  console.log("process should exit now");
}, 500);
