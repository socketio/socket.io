import { EventEmitter } from "node:events";
import { createServer, Server } from "node:http";
import expect = require("expect.js");
import { WebSocket } from "ws";
import { ClusterEngine, type Message } from "../lib/engine";
import { type ServerOptions } from "engine.io";
import { url, handshake } from "./util";

class InMemoryEngine extends ClusterEngine {
  constructor(readonly eventBus: EventEmitter, opts?: ServerOptions) {
    super(opts);
    eventBus.on("message", (message) => this.onMessage(message));
  }

  publishMessage(message: Message) {
    this.eventBus.emit("message", message);
  }
}

describe("in-memory", () => {
  let engine1: ClusterEngine,
    httpServer1: Server,
    engine2: ClusterEngine,
    httpServer2: Server,
    engine3: ClusterEngine,
    httpServer3: Server;

  beforeEach(() => {
    const eventBus = new EventEmitter();

    httpServer1 = createServer();
    engine1 = new InMemoryEngine(eventBus);
    engine1.attach(httpServer1);
    httpServer1.listen(3000);

    httpServer2 = createServer();
    engine2 = new InMemoryEngine(eventBus);
    engine2.attach(httpServer2);
    httpServer2.listen(3001);

    httpServer3 = createServer();
    engine3 = new InMemoryEngine(eventBus, {
      pingInterval: 50,
    });
    engine3.attach(httpServer3);
    httpServer3.listen(3002);
  });

  afterEach(() => {
    engine1.close();
    engine2.close();
    engine3.close();
    httpServer1.close();
    httpServer1.closeAllConnections();
    httpServer2.close();
    httpServer2.closeAllConnections();
    httpServer3.close();
    httpServer3.closeAllConnections();
  });

  it("should work (read)", (done) => {
    engine1.on("connection", (socket) => {
      socket.send("hello");
    });

    (async () => {
      const sid = await handshake(3000);

      const res = await fetch(url(3001, sid));
      expect(res.status).to.eql(200);

      const body = await res.text();
      expect(body).to.eql("4hello");

      done();
    })();
  });

  it("should work (read - deferred)", (done) => {
    engine1.on("connection", (socket) => {
      setTimeout(() => {
        socket.send("hello");
      }, 200);
    });

    (async () => {
      const sid = await handshake(3000);

      const res = await fetch(url(3001, sid));
      expect(res.status).to.eql(200);

      const body = await res.text();
      expect(body).to.eql("4hello");

      done();
    })();
  });

  it("should work (write)", (done) => {
    engine1.on("connection", (socket) => {
      socket.on("message", (data) => {
        expect(data).to.eql("hello");
        done();
      });
    });

    (async () => {
      const sid = await handshake(3000);

      const res = await fetch(url(3001, sid), {
        method: "POST",
        body: "4hello",
      });
      expect(res.status).to.eql(200);
    })();
  });

  it("should work (write - multiple)", (done) => {
    engine1.on("connection", (socket) => {
      let packets = [];

      socket.on("message", (data) => {
        packets.push(data);
        if (packets.length === 6) {
          expect(packets).to.eql(["1", "2", "3", "4", "5", "6"]);
          done();
        }
      });
    });

    (async () => {
      const sid = await handshake(3000);

      const res1 = await fetch(url(3001, sid), {
        method: "POST",
        body: "41\x1e42\x1e43",
      });
      expect(res1.status).to.eql(200);

      const res2 = await fetch(url(3000, sid), {
        method: "POST",
        body: "44\x1e45",
      });
      expect(res2.status).to.eql(200);

      const res3 = await fetch(url(3001, sid), {
        method: "POST",
        body: "46",
      });
      expect(res3.status).to.eql(200);
    })();
  });

  it("should acquire read lock (different process)", (done) => {
    (async () => {
      const sid = await handshake(3000);

      const controller = new AbortController();
      fetch(url(3000, sid), {
        signal: controller.signal,
      });

      const res = await fetch(url(3001, sid));
      expect(res.status).to.eql(400);

      controller.abort();
      done();
    })();
  });

  it("should acquire read lock (same process)", (done) => {
    (async () => {
      const sid = await handshake(3000);

      const controller = new AbortController();
      fetch(url(3001, sid), {
        signal: controller.signal,
      });

      const res = await fetch(url(3000, sid));
      expect(res.status).to.eql(400);

      controller.abort();
      done();
    })();
  });

  it("should handle close from main process", (done) => {
    engine1.on("connection", (socket) => {
      setTimeout(() => {
        socket.close();
      }, 100);
    });

    (async () => {
      const sid = await handshake(3000);

      const res = await fetch(url(3001, sid));
      expect(res.status).to.eql(200);

      const body = await res.text();
      expect(body).to.eql("1");

      done();
    })();
  });

  it("should handle close from client", (done) => {
    engine1.on("connection", (socket) => {
      socket.on("close", (reason) => {
        expect(reason).to.eql("transport error");
        done();
      });
    });

    (async () => {
      const sid = await handshake(3000);

      const controller = new AbortController();
      fetch(url(3001, sid), {
        signal: controller.signal,
      });

      setTimeout(() => {
        controller.abort();
      }, 100);
    })();
  });

  it("should ping/pong", function (done) {
    (async () => {
      const sid = await handshake(3002);

      for (let i = 0; i < 10; i++) {
        const port1 = [3000, 3001, 3002][i % 3];
        const res1 = await fetch(url(port1, sid));
        expect(res1.status).to.eql(200);
        const body1 = await res1.text();
        expect(body1).to.eql("2");

        const port2 = [3000, 3001, 3002][(i + 1) % 3];
        const res2 = await fetch(url(port2, sid), {
          method: "POST",
          body: "3",
        });
        expect(res2.status).to.eql(200);
      }

      // @ts-expect-error
      expect(engine1._requests.size).to.eql(0);
      // @ts-expect-error
      expect(engine2._requests.size).to.eql(0);
      // @ts-expect-error
      expect(engine3._requests.size).to.eql(0);
      // @ts-expect-error
      expect(engine1._remoteTransports.size).to.eql(0);
      // @ts-expect-error
      expect(engine2._remoteTransports.size).to.eql(0);
      // @ts-expect-error
      expect(engine3._remoteTransports.size).to.eql(0);

      done();
    })();
  });

  it("should reject an invalid id", (done) => {
    (async () => {
      const res = await fetch(url(3001, "01234567890123456789"));
      expect(res.status).to.eql(400);

      done();
    })();
  });

  it("should upgrade", (done) => {
    engine2.on("connection", (socket) => {
      socket.on("upgrade", () => {
        socket.send("hello");
      });

      socket.on("message", (val) => {
        expect(val).to.eql("hi");

        socket.close();
        done();
      });
    });

    (async () => {
      const sid = await handshake(3000);

      const socket = new WebSocket(
        `ws://localhost:3001/engine.io/?EIO=4&transport=websocket&sid=${sid}`
      );

      socket.onopen = () => {
        socket.send("2probe");
      };

      let i = 0;

      socket.onmessage = ({ data }) => {
        switch (i++) {
          case 0:
            expect(data).to.eql("3probe");
            socket.send("5");
            break;
          case 1:
            expect(data).to.eql("4hello");
            socket.send("4hi");
            break;
        }
      };
    })();
  });

  it("should upgrade and send buffered messages", (done) => {
    engine2.on("connection", (socket) => {
      socket.on("upgrade", () => {
        socket.send("hello");
      });

      socket.on("message", (val) => {
        expect(val).to.eql("hi");

        socket.close();
        done();
      });
    });

    (async () => {
      const sid = await handshake(3000);

      const res = await fetch(url(3001, sid), {
        method: "POST",
        body: "4hi",
      });
      expect(res.status).to.eql(200);

      const socket = new WebSocket(
        `ws://localhost:3001/engine.io/?EIO=4&transport=websocket&sid=${sid}`
      );

      socket.onopen = () => {
        socket.send("2probe");
      };

      let i = 0;

      socket.onmessage = ({ data }) => {
        switch (i++) {
          case 0:
            expect(data).to.eql("3probe");
            socket.send("5");
            break;
          case 1:
            expect(data).to.eql("4hello");
            break;
        }
      };
    })();
  });
});
