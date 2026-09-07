import { EventEmitter } from "node:events";
import { createServer, Server } from "node:http";
import { strict as assert } from "node:assert";
import { describe, it, beforeEach, afterEach } from "node:test";
import { WebSocket } from "ws";
import { ClusterEngine, type Message } from "../lib/engine";
import { type ServerOptions } from "engine.io";
import { url, handshake } from "./util";
import { type AddressInfo } from "node:net";

class InMemoryEngine extends ClusterEngine {
  constructor(
    readonly eventBus: EventEmitter,
    opts?: ServerOptions,
  ) {
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
    httpServer3: Server,
    ports: [number, number, number];

  beforeEach(() => {
    const eventBus = new EventEmitter();

    httpServer1 = createServer();
    engine1 = new InMemoryEngine(eventBus);
    engine1.attach(httpServer1);
    httpServer1.listen(0);
    const port1 = (httpServer1.address() as AddressInfo).port;

    httpServer2 = createServer();
    engine2 = new InMemoryEngine(eventBus);
    engine2.attach(httpServer2);
    httpServer2.listen(0);
    const port2 = (httpServer2.address() as AddressInfo).port;

    httpServer3 = createServer();
    engine3 = new InMemoryEngine(eventBus, {
      pingInterval: 50,
    });
    engine3.attach(httpServer3);
    httpServer3.listen(0);
    const port3 = (httpServer3.address() as AddressInfo).port;

    ports = [port1, port2, port3];
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

  it("should work (read)", async () => {
    engine1.on("connection", (socket) => {
      socket.send("hello");
    });

    const sid = await handshake(ports[0]);

    const res = await fetch(url(ports[1], sid));
    assert.equal(res.status, 200);

    const body = await res.text();
    assert.equal(body, "4hello");
  });

  it("should work (read - deferred)", async () => {
    engine1.on("connection", (socket) => {
      setTimeout(() => {
        socket.send("hello");
      }, 200);
    });

    const sid = await handshake(ports[0]);

    const res = await fetch(url(ports[1], sid));
    assert.equal(res.status, 200);

    const body = await res.text();
    assert.equal(body, "4hello");
  });

  it("should work (write)", async () => {
    const promise = new Promise<void>((resolve) => {
      engine1.on("connection", (socket) => {
        socket.on("message", (data: string) => {
          assert.equal(data, "hello");
          resolve();
        });
      });
    });

    const sid = await handshake(ports[0]);

    const res = await fetch(url(ports[1], sid), {
      method: "POST",
      body: "4hello",
    });
    assert.equal(res.status, 200);

    await promise;
  });

  it("should work (write - multiple)", async () => {
    const promise = new Promise<void>((resolve) => {
      engine1.on("connection", (socket) => {
        let packets: any[] = [];

        socket.on("message", (data: string) => {
          packets.push(data);
          if (packets.length === 6) {
            assert.deepEqual(packets, ["1", "2", "3", "4", "5", "6"]);
            resolve();
          }
        });
      });
    });

    const sid = await handshake(ports[0]);

    const res1 = await fetch(url(ports[1], sid), {
      method: "POST",
      body: "41\x1e42\x1e43",
    });
    assert.equal(res1.status, 200);

    const res2 = await fetch(url(ports[0], sid), {
      method: "POST",
      body: "44\x1e45",
    });
    assert.equal(res2.status, 200);

    const res3 = await fetch(url(ports[1], sid), {
      method: "POST",
      body: "46",
    });
    assert.equal(res3.status, 200);

    await promise;
  });

  it("should acquire read lock (different process)", async () => {
    const sid = await handshake(ports[0]);

    const controller = new AbortController();
    const fetchPromise = fetch(url(ports[0], sid), {
      signal: controller.signal,
    }).catch(() => {});

    const res = await fetch(url(ports[1], sid));
    assert.equal(res.status, 400);

    controller.abort();
    await fetchPromise;
  });

  it("should acquire read lock (same process)", async () => {
    const sid = await handshake(ports[0]);

    const controller = new AbortController();
    const fetchPromise = fetch(url(ports[1], sid), {
      signal: controller.signal,
    }).catch(() => {});

    const res = await fetch(url(ports[0], sid));
    assert.equal(res.status, 400);

    controller.abort();
    await fetchPromise;
  });

  it("should handle close from main process", async () => {
    engine1.on("connection", (socket) => {
      setTimeout(() => {
        socket.close();
      }, 100);
    });

    const sid = await handshake(ports[0]);

    const res = await fetch(url(ports[1], sid));
    assert.equal(res.status, 200);

    const body = await res.text();
    assert.equal(body, "1");
  });

  it("should handle close from client", async () => {
    const promise = new Promise<void>((resolve) => {
      engine1.on("connection", (socket) => {
        socket.on("close", (reason: string) => {
          assert.equal(reason, "transport error");
          resolve();
        });
      });
    });

    const sid = await handshake(ports[0]);

    const controller = new AbortController();
    fetch(url(ports[1], sid), {
      signal: controller.signal,
    }).catch(() => {});

    setTimeout(() => {
      controller.abort();
    }, 100);

    await promise;
  });

  it("should ping/pong", async () => {
    const sid = await handshake(ports[2]);

    for (let i = 0; i < 10; i++) {
      const port1 = ports[i % 3];
      const res1 = await fetch(url(port1, sid));
      assert.equal(res1.status, 200);
      const body1 = await res1.text();
      assert.equal(body1, "2");

      const port2 = ports[(i + 1) % 3];
      const res2 = await fetch(url(port2, sid), {
        method: "POST",
        body: "3",
      });
      assert.equal(res2.status, 200);
    }

    // @ts-expect-error
    assert.equal(engine1._requests.size, 0);
    // @ts-expect-error
    assert.equal(engine2._requests.size, 0);
    // @ts-expect-error
    assert.equal(engine3._requests.size, 0);
    // @ts-expect-error
    assert.equal(engine1._remoteTransports.size, 0);
    // @ts-expect-error
    assert.equal(engine2._remoteTransports.size, 0);
    // @ts-expect-error
    assert.equal(engine3._remoteTransports.size, 0);
  });

  it("should reject an invalid id", async () => {
    const res = await fetch(url(ports[1], "01234567890123456789"));
    assert.equal(res.status, 400);
  });

  it("should upgrade", async () => {
    const promise = new Promise<void>((resolve) => {
      engine2.on("connection", (socket) => {
        socket.on("upgrade", () => {
          socket.send("hello");
        });

        socket.on("message", (val: string) => {
          assert.equal(val, "hi");

          socket.close();
          resolve();
        });
      });
    });

    const sid = await handshake(ports[0]);

    const socket = new WebSocket(
      `ws://localhost:${ports[1]}/engine.io/?EIO=4&transport=websocket&sid=${sid}`,
    );

    socket.onopen = () => {
      socket.send("2probe");
    };

    let i = 0;

    socket.onmessage = ({ data }) => {
      switch (i++) {
        case 0:
          assert.equal(data, "3probe");
          socket.send("5");
          break;
        case 1:
          assert.equal(data, "4hello");
          socket.send("4hi");
          break;
      }
    };

    await promise;
  });

  it("should upgrade and send buffered messages", async () => {
    const promise = new Promise<void>((resolve) => {
      engine2.on("connection", (socket) => {
        socket.on("upgrade", () => {
          socket.send("hello");
        });

        socket.on("message", (val: string) => {
          assert.equal(val, "hi");

          socket.close();
          resolve();
        });
      });
    });

    const sid = await handshake(ports[0]);

    const res = await fetch(url(ports[1], sid), {
      method: "POST",
      body: "4hi",
    });
    assert.equal(res.status, 200);

    const socket = new WebSocket(
      `ws://localhost:${ports[1]}/engine.io/?EIO=4&transport=websocket&sid=${sid}`,
    );

    socket.onopen = () => {
      socket.send("2probe");
    };

    let i = 0;

    socket.onmessage = ({ data }) => {
      switch (i++) {
        case 0:
          assert.equal(data, "3probe");
          socket.send("5");
          break;
        case 1:
          assert.equal(data, "4hello");
          break;
      }
    };

    await promise;
  });
});
