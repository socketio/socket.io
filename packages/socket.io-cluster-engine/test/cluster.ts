import cluster from "node:cluster";
import expect = require("expect.js");
import { handshake, url } from "./util";
import { setupPrimary } from "../lib";

cluster.setupPrimary({
  exec: "./test/worker.js",
  // @ts-expect-error
  serialization: "advanced", // needed for packets with Buffer objects
});

setupPrimary();

describe("cluster", () => {
  beforeEach((done) => {
    for (let i = 0; i < 3; i++) {
      const worker = cluster.fork();

      if (i === 2) {
        worker.on("listening", () => done());
      }
    }
  });

  afterEach((done) => {
    for (const worker of Object.values(cluster.workers)) {
      worker.kill();
    }
    function onExit() {
      if (Object.keys(cluster.workers).length === 0) {
        cluster.off("exit", onExit);
        done();
      }
    }
    cluster.on("exit", onExit);
  });

  it("should ping/pong", (done) => {
    (async () => {
      const sid = await handshake(3000);

      for (let i = 0; i < 10; i++) {
        const pollRes = await fetch(url(3000, sid));
        expect(pollRes.status).to.eql(200);
        const body = await pollRes.text();
        expect(body).to.eql("2");

        const dataRes = await fetch(url(3000, sid), {
          method: "POST",
          body: "3",
        });
        expect(dataRes.status).to.eql(200);
      }

      done();
    })();
  });

  it("should send and receive binary", (done) => {
    (async () => {
      const sid = await handshake(3000);

      const dataRes = await fetch(url(3000, sid), {
        method: "POST",
        body: "bAQIDBA==", // buffer <01 02 03 04> encoded as base64
      });
      expect(dataRes.status).to.eql(200);

      for (let i = 0; i < 100; i++) {
        const pollRes = await fetch(url(3000, sid));
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
