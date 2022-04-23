---
name: Bug report
about: Create a report to help us improve
title: ''
labels: 'to triage'
assignees: ''

---

**Describe the bug**
A clear and concise description of what the bug is.

**To Reproduce**

Please fill the following code example:

Socket.IO server version: `x.y.z`

*Server*

```js
import { Server } from "socket.io";

const io = new Server(3000, {});

io.on("connection", (socket) => {
  console.log(`connect ${socket.id}`);

  socket.on("disconnect", () => {
    console.log(`disconnect ${socket.id}`);
  });
});
```

Socket.IO client version: `x.y.z`

*Client*

```js
import { io } from "socket.io-client";

const socket = io("ws://localhost:3000/", {});

socket.on("connect", () => {
  console.log(`connect ${socket.id}`);
});

socket.on("disconnect", () => {
  console.log("disconnect");
});
```

**Expected behavior**
A clear and concise description of what you expected to happen.

**Platform:**
 - Device: [e.g. Samsung S8]
 - OS: [e.g. Android 9.2]

**Additional context**
Add any other context about the problem here.
