import cluster from "node:cluster";
import { strict as assert } from "node:assert";
import { describe, it, beforeEach, afterEach } from "node:test";
import { handshake, url } from "./util";
import { setupPrimary } from "../lib";

const WORKER_COUNT = 3;

cluster.setupPrimary({
  exec: "./test/worker.js",
  serialization: "advanced", // needed for packets with Buffer objects
});

setupPrimary();

describe("cluster", () => {
  beforeEach(async () => {
    return new Promise<void>((resolve) => {
      for (let i = 0; i < WORKER_COUNT; i++) {
        const worker = cluster.fork();

        if (i === 2) {
          worker.on("listening", () => resolve());
        }
      }
    });
  });

  afterEach(async () => {
    return new Promise<void>((resolve) => {
      let i = 0;
      function onExit() {
        if (++i === WORKER_COUNT) {
          cluster.off("exit", onExit);
          resolve();
        }
      }
      cluster.on("exit", onExit);

      for (const worker of Object.values(cluster.workers)) {
        worker.kill();
      }
    });
  });

  it("should ping/pong", async () => {
    const sid = await handshake(3000);

    for (let i = 0; i < 10; i++) {
      const pollRes = await fetch(url(3000, sid));
      assert.equal(pollRes.status, 200);
      const body = await pollRes.text();
      assert.equal(body, "2");

      const dataRes = await fetch(url(3000, sid), {
        method: "POST",
        body: "3",
      });
      assert.equal(dataRes.status, 200);
    }
  });

  it("should send and receive binary", async () => {
    const sid = await handshake(3000);

    const dataRes = await fetch(url(3000, sid), {
      method: "POST",
      body: "bAQIDBA==", // buffer <01 02 03 04> encoded as base64
    });
    assert.equal(dataRes.status, 200);

    for (let i = 0; i < 100; i++) {
      const pollRes = await fetch(url(3000, sid));
      assert.equal(pollRes.status, 200);
      const body = await pollRes.text();

      if (body === "bAQIDBA==") {
        return;
      } else {
        // ping packet
      }
    }
    assert.fail("Binary data not received");
  });
});
