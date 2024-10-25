"use strict";

describe("socket.io", () => {
  require("./server-attachment");
  require("./handshake");
  require("./close");
  require("./namespaces");
  require("./socket");
  require("./messaging-many");
  require("./middleware");
  require("./socket-middleware");
  require("./v2-compatibility");
  require("./socket-timeout");
  require("./uws");
  require("./utility-methods");
  require("./connection-state-recovery");
});
