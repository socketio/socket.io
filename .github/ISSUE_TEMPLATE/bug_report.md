---
name: Bug report
about: Create a report to help us improve
title: ''
labels: 'bug'
assignees: ''

---

**Describe the bug**
A clear and concise description of what the bug is.

**To Reproduce**

Please fill the following code example:

Engine.IO server version: `x.y.z`

*Server*

```js
const engine = require("engine.io");
const server = engine.listen(3000, {});

server.on("connection", (socket) => {
  console.log("connection");

  socket.on("message", (data) => {
    console.log("data", data);
  });

  socket.on("close", () => {
    console.log("close");
  });
});
```

Engine.IO client version: `x.y.z`

*Client*

```js
const socket = require("engine.io-client")("ws://localhost:3000");

socket.on("open", () => {
  console.log("open");

  socket.on("message", (data) => {
    console.log("data", data);
  });

  socket.on("close", () => {
    console.log("close");
  });
});
```

**Expected behavior**
A clear and concise description of what you expected to happen.

**Platform:**
 - Device: [e.g. Samsung S8]
 - OS: [e.g. Android 9.2]

**Additional context**
Add any other context about the problem here.
