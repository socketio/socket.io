const io = require("../..");
const socket = io("http://localhost:3211", {
  autoUnref: false,
});

setTimeout(() => {
  console.log("process should not exit");
}, 500);
