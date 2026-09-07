import { strict as assert } from "node:assert";
import { describe, it, beforeEach, afterEach } from "node:test";
import { createServer } from "node:http";
import { createClient } from "redis";
import { handshake, url } from "./util";
import { type ClusterEngine } from "../lib/engine";
import { RedisEngine } from "../lib";
import Redis from "ioredis";
import { type AddressInfo } from "node:net";

describe("redis", () => {
  let engine1: ClusterEngine,
    engine2: ClusterEngine,
    engine3: ClusterEngine,
    cleanup: () => Promise<void>,
    ports: [number, number, number];

  describe("redis package", () => {
    beforeEach(async () => {
      const pubClient = createClient();
      const subClient1 = pubClient.duplicate();
      const subClient2 = pubClient.duplicate();
      const subClient3 = pubClient.duplicate();

      await Promise.all([
        pubClient.connect(),
        subClient1.connect(),
        subClient2.connect(),
        subClient3.connect(),
      ]);

      const httpServer1 = createServer();
      engine1 = new RedisEngine(pubClient, subClient1);
      engine1.attach(httpServer1);
      httpServer1.listen(0);
      const port1 = (httpServer1.address() as AddressInfo).port;

      const httpServer2 = createServer();
      engine2 = new RedisEngine(pubClient, subClient2);
      engine2.attach(httpServer2);
      httpServer2.listen(0);
      const port2 = (httpServer2.address() as AddressInfo).port;

      const httpServer3 = createServer();
      engine3 = new RedisEngine(pubClient, subClient3, {
        pingInterval: 50,
      });
      engine3.attach(httpServer3);
      httpServer3.listen(0);
      const port3 = (httpServer3.address() as AddressInfo).port;

      ports = [port1, port2, port3];

      cleanup = async () => {
        engine1.close();
        engine2.close();
        engine3.close();
        httpServer1.close();
        httpServer1.closeAllConnections();
        httpServer2.close();
        httpServer2.closeAllConnections();
        httpServer3.close();
        httpServer3.closeAllConnections();

        await Promise.all([
          subClient1.unsubscribe(),
          subClient2.unsubscribe(),
          subClient3.unsubscribe(),
        ]);

        await Promise.all([
          pubClient.disconnect(),
          subClient1.disconnect(),
          subClient2.disconnect(),
          subClient3.disconnect(),
        ]);
      };
    });

    afterEach(() => {
      return cleanup();
    });

    it("should ping/pong", async () => {
      const sid = await handshake(ports[2]);

      for (let i = 0; i < 10; i++) {
        const pollPort = ports[i % 3];
        const pollRes = await fetch(url(pollPort, sid));
        assert.equal(pollRes.status, 200);
        const body = await pollRes.text();
        assert.equal(body, "2");

        const dataPort = ports[(i + 1) % 3];
        const dataRes = await fetch(url(dataPort, sid), {
          method: "POST",
          body: "3",
        });
        assert.equal(dataRes.status, 200);
      }
    });

    it("should send and receive binary", async () => {
      engine1.on("connection", (socket) => {
        socket.on("message", (val: any) => {
          socket.send(val);
        });
      });

      const sid = await handshake(ports[0]);

      const dataRes = await fetch(url(ports[1], sid), {
        method: "POST",
        body: "bAQIDBA==", // buffer <01 02 03 04> encoded as base64
      });
      assert.equal(dataRes.status, 200);

      while (true) {
        const pollRes = await fetch(url(ports[2], sid));
        assert.equal(pollRes.status, 200);
        const body = await pollRes.text();

        if (body === "bAQIDBA==") {
          break;
        } else {
          // ping packet
        }
      }
    });
  });

  describe("ioredis package", () => {
    beforeEach(async () => {
      const pubClient = new Redis();
      const subClient1 = pubClient.duplicate();
      const subClient2 = pubClient.duplicate();
      const subClient3 = pubClient.duplicate();

      const httpServer1 = createServer();
      engine1 = new RedisEngine(pubClient, subClient1);
      engine1.attach(httpServer1);
      httpServer1.listen(0);
      const port1 = (httpServer1.address() as AddressInfo).port;

      const httpServer2 = createServer();
      engine2 = new RedisEngine(pubClient, subClient2);
      engine2.attach(httpServer2);
      httpServer2.listen(0);
      const port2 = (httpServer2.address() as AddressInfo).port;

      const httpServer3 = createServer();
      engine3 = new RedisEngine(pubClient, subClient3, {
        pingInterval: 50,
      });
      engine3.attach(httpServer3);
      httpServer3.listen(0);
      const port3 = (httpServer3.address() as AddressInfo).port;

      ports = [port1, port2, port3];

      cleanup = async () => {
        engine1.close();
        engine2.close();
        engine3.close();
        httpServer1.close();
        httpServer1.closeAllConnections();
        httpServer2.close();
        httpServer2.closeAllConnections();
        httpServer3.close();
        httpServer3.closeAllConnections();

        pubClient.disconnect();
        subClient1.disconnect();
        subClient2.disconnect();
        subClient3.disconnect();
      };
    });

    afterEach(() => {
      return cleanup();
    });

    it("should ping/pong", async () => {
      const sid = await handshake(ports[2]);

      for (let i = 0; i < 10; i++) {
        const pollPort = [ports[0], ports[1], ports[2]][i % 3];
        const pollRes = await fetch(url(pollPort, sid));
        assert.equal(pollRes.status, 200);
        const body = await pollRes.text();
        assert.equal(body, "2");

        const dataPort = [ports[0], ports[1], ports[2]][(i + 1) % 3];
        const dataRes = await fetch(url(dataPort, sid), {
          method: "POST",
          body: "3",
        });
        assert.equal(dataRes.status, 200);
      }
    });

    it("should send and receive binary", async () => {
      engine1.on("connection", (socket) => {
        socket.on("message", (val: any) => {
          socket.send(val);
        });
      });

      const sid = await handshake(ports[0]);

      const dataRes = await fetch(url(ports[1], sid), {
        method: "POST",
        body: "bAQIDBA==", // buffer <01 02 03 04> encoded as base64
      });
      assert.equal(dataRes.status, 200);

      while (true) {
        const pollRes = await fetch(url(ports[2], sid));
        assert.equal(pollRes.status, 200);
        const body = await pollRes.text();

        if (body === "bAQIDBA==") {
          break;
        } else {
          // ping packet
        }
      }
    });
  });
});
