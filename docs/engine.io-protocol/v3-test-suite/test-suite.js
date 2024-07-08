const isNodejs = typeof window === "undefined";

if (isNodejs) {
  // make the tests runnable in both the browser and Node.js
  await import("./node-imports.js");
}

const { expect } = chai;

const URL = "http://localhost:3000";
const WS_URL = URL.replace("http", "ws");

const PING_INTERVAL = 300;
const PING_TIMEOUT = 200;

function sleep(delay) {
  return new Promise((resolve) => setTimeout(resolve, delay));
}

function waitFor(socket, eventType) {
  return new Promise((resolve) => {
    socket.addEventListener(
      eventType,
      (event) => {
        resolve(event);
      },
      { once: true }
    );
  });
}

function decodePayload(payload) {
  const firstColonIndex = payload.indexOf(":");
  const length = payload.substring(0, firstColonIndex);
  const packet = payload.substring(firstColonIndex + 1);
  return [length, packet];
}

async function initLongPollingSession(supportsBinary = false) {
  const response = await fetch(`${URL}/engine.io/?EIO=3&transport=polling` + (supportsBinary ? "" : "&b64=1"));
  const text = await response.text();
  const [, content] = decodePayload(text);
  return JSON.parse(content.substring(1)).sid;
}

describe("Engine.IO protocol", () => {
  describe("handshake", () => {
    describe("HTTP long-polling", () => {
      it("successfully opens a session", async () => {
        const response = await fetch(
          `${URL}/engine.io/?EIO=3&transport=polling`
        );

        expect(response.status).to.eql(200);

        const text = await response.text();
        const [length, content] = decodePayload(text);

        expect(length).to.eql(content.length.toString());
        expect(content).to.startsWith("0");

        const value = JSON.parse(content.substring(1));

        expect(value.sid).to.be.a("string");
        expect(value.upgrades).to.eql(["websocket"]);
        expect(value.pingInterval).to.eql(PING_INTERVAL);
        expect(value.pingTimeout).to.eql(PING_TIMEOUT);
        expect(value.maxPayload).to.be.oneOf([undefined, 1000000]);
      });

      it("fails with an invalid 'transport' query parameter", async () => {
        const response = await fetch(`${URL}/engine.io/?EIO=3`);

        expect(response.status).to.eql(400);

        const response2 = await fetch(`${URL}/engine.io/?EIO=3&transport=abc`);

        expect(response2.status).to.eql(400);
      });

      it("fails with an invalid request method", async () => {
        const response = await fetch(
          `${URL}/engine.io/?EIO=3&transport=polling`,
          {
            method: "post",
          }
        );

        expect(response.status).to.eql(400);
      });
    });

    describe("WebSocket", () => {
      it("successfully opens a session", async () => {
        const socket = new WebSocket(
          `${WS_URL}/engine.io/?EIO=3&transport=websocket`
        );

        const { data } = await waitFor(socket, "message");

        expect(data).to.startsWith("0");

        const value = JSON.parse(data.substring(1));

        expect(value.sid).to.be.a("string");
        expect(value.upgrades).to.eql([]);
        expect(value.pingInterval).to.eql(PING_INTERVAL);
        expect(value.pingTimeout).to.eql(PING_TIMEOUT);
        expect(value.maxPayload).to.be.oneOf([undefined, 1000000]);

        socket.close();
      });

      it("fails with an invalid 'EIO' query parameter", async () => {
        const socket = new WebSocket(
          `${WS_URL}/engine.io/?transport=websocket`
        );

        if (isNodejs) {
          socket.on("error", () => {});
        }

        waitFor(socket, "close");

        const socket2 = new WebSocket(
          `${WS_URL}/engine.io/?EIO=abc&transport=websocket`
        );

        if (isNodejs) {
          socket2.on("error", () => {});
        }

        waitFor(socket2, "close");
      });

      it("fails with an invalid 'transport' query parameter", async () => {
        const socket = new WebSocket(`${WS_URL}/engine.io/?EIO=3`);

        if (isNodejs) {
          socket.on("error", () => {});
        }

        waitFor(socket, "close");

        const socket2 = new WebSocket(
          `${WS_URL}/engine.io/?EIO=3&transport=abc`
        );

        if (isNodejs) {
          socket2.on("error", () => {});
        }

        waitFor(socket2, "close");
      });
    });
  });

  describe("message", () => {
    describe("HTTP long-polling", () => {
      it("sends and receives a payload containing one plain text packet", async () => {
        const sid = await initLongPollingSession();

        const pushResponse = await fetch(
          `${URL}/engine.io/?EIO=3&transport=polling&sid=${sid}`,
          {
            method: "post",
            body: "6:4hello",
          }
        );

        expect(pushResponse.status).to.eql(200);

        const postContent = await pushResponse.text();

        expect(postContent).to.eql("ok");

        const pollResponse = await fetch(
          `${URL}/engine.io/?EIO=3&transport=polling&sid=${sid}`
        );

        expect(pollResponse.status).to.eql(200);

        const pollContent = await pollResponse.text();

        expect(pollContent).to.eql("6:4hello");
      });

      it("sends and receives a payload containing several plain text packets", async () => {
        const sid = await initLongPollingSession();

        const pushResponse = await fetch(
          `${URL}/engine.io/?EIO=3&transport=polling&sid=${sid}`,
          {
            method: "post",
            body: "6:4test16:4test26:4test3",
          }
        );

        expect(pushResponse.status).to.eql(200);

        const postContent = await pushResponse.text();

        expect(postContent).to.eql("ok");

        const pollResponse = await fetch(
          `${URL}/engine.io/?EIO=3&transport=polling&sid=${sid}`
        );

        expect(pollResponse.status).to.eql(200);

        const pollContent = await pollResponse.text();

        expect(pollContent).to.eql("6:4test16:4test26:4test3");
      });

      it("sends and receives a payload containing plain text and binary packets (base64 encoded)", async () => {
        const sid = await initLongPollingSession();

        const pushResponse = await fetch(
          `${URL}/engine.io/?EIO=3&transport=polling&sid=${sid}`,
          {
            method: "post",
            body: "6:4hello10:b4AQIDBA==",
          }
        );

        expect(pushResponse.status).to.eql(200);

        const postContent = await pushResponse.text();

        expect(postContent).to.eql("ok");

        const pollResponse = await fetch(
          `${URL}/engine.io/?EIO=3&transport=polling&sid=${sid}`
        );

        expect(pollResponse.status).to.eql(200);

        const pollContent = await pollResponse.text();

        expect(pollContent).to.eql("6:4hello10:b4AQIDBA==");
      });

      it("sends and receives a payload containing plain text and binary packets (binary)", async () => {
        const sid = await initLongPollingSession(true);

        const pushResponse = await fetch(
          `${URL}/engine.io/?EIO=3&transport=polling&sid=${sid}`,
          {
            method: "post",
            body: "6:4hello10:b4AQIDBA==",
          }
        );

        expect(pushResponse.status).to.eql(200);

        const postContent = await pushResponse.text();

        expect(postContent).to.eql("ok");

        const pollResponse = await fetch(
          `${URL}/engine.io/?EIO=3&transport=polling&sid=${sid}`
        );

        expect(pollResponse.status).to.eql(200);

        const buffer = await pollResponse.arrayBuffer();

        // 0                    => string
        // 6                    => byte length
        // 255                  => delimiter
        // 52                   => 4 (MESSAGE packet type)
        // 104 101 108 108 111  => "hello"
        // 1                    => binary
        // 5                    => byte length
        // 255                  => delimiter
        // 4                    => 4 (MESSAGE packet type)
        // 1 2 3 4              => binary message
        expect(buffer).to.eql(Uint8Array.from([0, 6, 255, 52, 104, 101, 108, 108, 111, 1, 5, 255, 4, 1, 2, 3, 4]).buffer);
      });

      it("closes the session upon invalid packet format", async () => {
        const sid = await initLongPollingSession();

        try {
          const pushResponse = await fetch(
            `${URL}/engine.io/?EIO=3&transport=polling&sid=${sid}`,
            {
              method: "post",
              body: "abc",
            }
          );

          expect(pushResponse.status).to.eql(400);
        } catch (e) {
          // node-fetch throws when the request is closed abnormally
        }

        const pollResponse = await fetch(
          `${URL}/engine.io/?EIO=3&transport=polling&sid=${sid}`
        );

        expect(pollResponse.status).to.eql(400);
      });

      // FIXME CORS error
      it.skip("closes the session upon duplicate poll requests", async () => {
        const sid = await initLongPollingSession();

        const pollResponses = await Promise.all([
          fetch(`${URL}/engine.io/?EIO=3&transport=polling&sid=${sid}`),
          sleep(5).then(() => fetch(`${URL}/engine.io/?EIO=3&transport=polling&sid=${sid}&t=burst`)),
        ]);

        expect(pollResponses[0].status).to.eql(200);

        const content = await pollResponses[0].text();

        expect(content).to.eql("1:1");

        // the Node.js implementation uses HTTP 500 (Internal Server Error), but HTTP 400 seems more suitable
        expect(pollResponses[1].status).to.be.oneOf([400, 500]);

        const pollResponse = await fetch(
          `${URL}/engine.io/?EIO=3&transport=polling&sid=${sid}`
        );

        expect(pollResponse.status).to.eql(500);
      });
    });

    describe("WebSocket", () => {
      it("sends and receives a plain text packet", async () => {
        const socket = new WebSocket(
          `${WS_URL}/engine.io/?EIO=3&transport=websocket`
        );

        await waitFor(socket, "open");

        await waitFor(socket, "message"); // handshake

        socket.send("4hello");

        const { data } = await waitFor(socket, "message");

        expect(data).to.eql("4hello");

        socket.close();
      });

      it("sends and receives a binary packet", async () => {
        const socket = new WebSocket(
          `${WS_URL}/engine.io/?EIO=3&transport=websocket`
        );
        socket.binaryType = "arraybuffer";

        await waitFor(socket, "message"); // handshake

        socket.send(Uint8Array.from([4, 1, 2, 3, 4]));

        const { data } = await waitFor(socket, "message");

        expect(data).to.eql(Uint8Array.from([4, 1, 2, 3, 4]).buffer);

        socket.close();
      });

      it("closes the session upon invalid packet format", async () => {
        const socket = new WebSocket(
          `${WS_URL}/engine.io/?EIO=3&transport=websocket`
        );

        await waitFor(socket, "message"); // handshake

        socket.send("abc");

        await waitFor(socket, "close");

        socket.close();
      });
    });
  });

  describe("heartbeat", function () {
    this.timeout(5000);

    describe("HTTP long-polling", () => {
      it("sends ping/pong packets", async () => {
        const sid = await initLongPollingSession();

        for (let i = 0; i < 3; i++) {
          const pushResponse = await fetch(
            `${URL}/engine.io/?EIO=3&transport=polling&sid=${sid}`,
            {
              method: "post",
              body: "1:2",
            }
          );

          expect(pushResponse.status).to.eql(200);

          const pollResponse = await fetch(
            `${URL}/engine.io/?EIO=3&transport=polling&sid=${sid}`
          );

          expect(pollResponse.status).to.eql(200);

          const pollContent = await pollResponse.text();

          expect(pollContent).to.eql("1:3");
        }
      });

      it("closes the session upon ping timeout", async () => {
        const sid = await initLongPollingSession();

        await sleep(PING_INTERVAL + PING_TIMEOUT);

        const pushResponse = await fetch(
          `${URL}/engine.io/?EIO=3&transport=polling&sid=${sid}`,
          {
            method: "post",
            body: "1:2",
          }
        );

        expect(pushResponse.status).to.eql(400);
      });
    });

    describe("WebSocket", () => {
      it("sends ping/pong packets", async () => {
        const socket = new WebSocket(
          `${WS_URL}/engine.io/?EIO=3&transport=websocket`
        );

        const x = await waitFor(socket, "message"); // handshake

        for (let i = 0; i < 3; i++) {
          socket.send("2");

          const { data } = await waitFor(socket, "message");

          expect(data).to.eql("3");
        }

        socket.close();
      });

      it("closes the session upon ping timeout", async () => {
        const socket = new WebSocket(
          `${WS_URL}/engine.io/?EIO=3&transport=websocket`
        );

        await waitFor(socket, "close"); // handshake
      });
    });
  });

  describe("close", () => {
    describe("HTTP long-polling", () => {
      it("forcefully closes the session", async () => {
        const sid = await initLongPollingSession();

        const [pollResponse] = await Promise.all([
          fetch(`${URL}/engine.io/?EIO=3&transport=polling&sid=${sid}`),
          fetch(`${URL}/engine.io/?EIO=3&transport=polling&sid=${sid}`, {
            method: "post",
            body: "1:1",
          }),
        ]);

        expect(pollResponse.status).to.eql(200);

        const pullContent = await pollResponse.text();

        expect(pullContent).to.eql("1:6");

        const pollResponse2 = await fetch(
          `${URL}/engine.io/?EIO=3&transport=polling&sid=${sid}`
        );

        expect(pollResponse2.status).to.eql(400);
      });
    });

    describe("WebSocket", () => {
      it("forcefully closes the session", async () => {
        const socket = new WebSocket(
          `${WS_URL}/engine.io/?EIO=3&transport=websocket`
        );

        await waitFor(socket, "message"); // handshake

        socket.send("1");

        await waitFor(socket, "close");
      });
    });
  });

  describe("upgrade", () => {
    it("successfully upgrades from HTTP long-polling to WebSocket", async () => {
      const sid = await initLongPollingSession();

      const socket = new WebSocket(
        `${WS_URL}/engine.io/?EIO=3&transport=websocket&sid=${sid}`
      );

      await waitFor(socket, "open");

      // send probe
      socket.send("2probe");

      const probeResponse = await waitFor(socket, "message");

      expect(probeResponse.data).to.eql("3probe");

      const pollResponse = await fetch(
        `${URL}/engine.io/?EIO=3&transport=polling&sid=${sid}`
      );

      expect(pollResponse.status).to.eql(200);

      const pollContent = await pollResponse.text();

      expect(pollContent).to.eql("1:6"); // "noop" packet to cleanly end the HTTP long-polling request

      // complete upgrade
      socket.send("5");

      socket.send("4hello");

      const { data } = await waitFor(socket, "message");

      expect(data).to.eql("4hello");
    });

    it("ignores HTTP requests with same sid after upgrade", async () => {
      const sid = await initLongPollingSession();

      const socket = new WebSocket(
        `${WS_URL}/engine.io/?EIO=3&transport=websocket&sid=${sid}`
      );

      await waitFor(socket, "open");

      socket.send("2probe");
      const res = await waitFor(socket, "message");
      expect(res.data).to.eql("3probe");

      socket.send("5");

      const pollResponse = await fetch(
        `${URL}/engine.io/?EIO=3&transport=polling&sid=${sid}`
      );

      expect(pollResponse.status).to.eql(400);

      socket.send("4hello");

      const { data } = await waitFor(socket, "message");

      expect(data).to.eql("4hello");
    });

    it("ignores WebSocket connection with same sid after upgrade", async () => {
      const sid = await initLongPollingSession();

      const socket = new WebSocket(
        `${WS_URL}/engine.io/?EIO=3&transport=websocket&sid=${sid}`
      );

      await waitFor(socket, "open");

      socket.send("2probe");
      const res = await waitFor(socket, "message");
      expect(res.data).to.eql("3probe");

      socket.send("5");

      const socket2 = new WebSocket(
        `${WS_URL}/engine.io/?EIO=3&transport=websocket&sid=${sid}`
      );

      await waitFor(socket2, "close");

      socket.send("4hello");

      const { data } = await waitFor(socket, "message");

      expect(data).to.eql("4hello");
    });
  });
});
