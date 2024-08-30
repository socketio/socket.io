"use strict";

import expect from "expect.js";

describe("socket.io", () => {
  it("should be the same version as client", () => {
    const version = require("../package").version;
    expect(version).to.be(require("socket.io-client/package.json").version);
  });

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
