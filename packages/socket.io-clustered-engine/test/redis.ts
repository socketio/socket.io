import expect = require("expect.js");
import { createServer } from "node:http";
import { createClient } from "redis";
import { handshake, url } from "./util";
import { type ClusterEngine } from "../lib/engine";
import { RedisEngine } from "../lib";
import Redis from "ioredis";

describe("redis", () => {
  let engine1: ClusterEngine,
    engine2: ClusterEngine,
    engine3: ClusterEngine,
    cleanup: () => Promise<void>;

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
      httpServer1.listen(3000);

      const httpServer2 = createServer();
      engine2 = new RedisEngine(pubClient, subClient2);
      engine2.attach(httpServer2);
      httpServer2.listen(3001);

      const httpServer3 = createServer();
      engine3 = new RedisEngine(pubClient, subClient3, {
        pingInterval: 50,
      });
      engine3.attach(httpServer3);
      httpServer3.listen(3002);

      cleanup = () => {
        engine1.close();
        engine2.close();
        engine3.close();
        httpServer1.close();
        httpServer1.closeAllConnections();
        httpServer2.close();
        httpServer2.closeAllConnections();
        httpServer3.close();
        httpServer3.closeAllConnections();

        return Promise.all([
          pubClient.disconnect(),
          subClient1.disconnect(),
          subClient2.disconnect(),
          subClient3.disconnect(),
        ]).then();
      };
    });

    afterEach(() => {
      return cleanup();
    });

    it("should ping/pong", (done) => {
      (async () => {
        const sid = await handshake(3002);

        for (let i = 0; i < 10; i++) {
          const pollPort = [3000, 3001, 3002][i % 3];
          const pollRes = await fetch(url(pollPort, sid));
          expect(pollRes.status).to.eql(200);
          const body = await pollRes.text();
          expect(body).to.eql("2");

          const dataPort = [3000, 3001, 3002][(i + 1) % 3];
          const dataRes = await fetch(url(dataPort, sid), {
            method: "POST",
            body: "3",
          });
          expect(dataRes.status).to.eql(200);
        }

        done();
      })();
    });

    it("should send and receive binary", (done) => {
      engine1.on("connection", (socket) => {
        socket.on("message", (val: any) => {
          socket.send(val);
        });
      });

      (async () => {
        const sid = await handshake(3000);

        const dataRes = await fetch(url(3001, sid), {
          method: "POST",
          body: "bAQIDBA==", // buffer <01 02 03 04> encoded as base64
        });
        expect(dataRes.status).to.eql(200);

        while (true) {
          const pollRes = await fetch(url(3002, sid));
          expect(pollRes.status).to.eql(200);
          const body = await pollRes.text();

          if (body === "bAQIDBA==") {
            done();
            break;
          } else {
            // ping packet
          }
        }
      })();
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
      httpServer1.listen(3000);

      const httpServer2 = createServer();
      engine2 = new RedisEngine(pubClient, subClient2);
      engine2.attach(httpServer2);
      httpServer2.listen(3001);

      const httpServer3 = createServer();
      engine3 = new RedisEngine(pubClient, subClient3, {
        pingInterval: 50,
      });
      engine3.attach(httpServer3);
      httpServer3.listen(3002);

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

    it("should ping/pong", (done) => {
      (async () => {
        const sid = await handshake(3002);

        for (let i = 0; i < 10; i++) {
          const pollPort = [3000, 3001, 3002][i % 3];
          const pollRes = await fetch(url(pollPort, sid));
          expect(pollRes.status).to.eql(200);
          const body = await pollRes.text();
          expect(body).to.eql("2");

          const dataPort = [3000, 3001, 3002][(i + 1) % 3];
          const dataRes = await fetch(url(dataPort, sid), {
            method: "POST",
            body: "3",
          });
          expect(dataRes.status).to.eql(200);
        }

        done();
      })();
    });

    it("should send and receive binary", (done) => {
      engine1.on("connection", (socket) => {
        socket.on("message", (val: any) => {
          socket.send(val);
        });
      });

      (async () => {
        const sid = await handshake(3000);

        const dataRes = await fetch(url(3001, sid), {
          method: "POST",
          body: "bAQIDBA==", // buffer <01 02 03 04> encoded as base64
        });
        expect(dataRes.status).to.eql(200);

        while (true) {
          const pollRes = await fetch(url(3002, sid));
          expect(pollRes.status).to.eql(200);
          const body = await pollRes.text();

          if (body === "bAQIDBA==") {
            done();
            break;
          } else {
            // ping packet
          }
        }
      })();
    });
  });
});
