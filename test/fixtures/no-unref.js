const eio = require("../..").default;
const socket = eio("http://localhost:3000", {
  autoUnref: false
});

setTimeout(() => {
  console.log("process should not exit");
}, 500);
