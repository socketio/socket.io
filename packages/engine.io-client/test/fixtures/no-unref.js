const { Socket } = require("../..");
const socket = new Socket("http://localhost:3000", {
  autoUnref: false,
});

setTimeout(() => {
  console.log("process should not exit");
}, 50);
