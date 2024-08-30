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

async function initLongPollingSession() {
  const response = await fetch(`${URL}/engine.io/?EIO=4&transport=polling`);
  const content = await response.text();
  return JSON.parse(content.substring(1)).sid;
}

describe("Engine.IO protocol", () => {
  describe("handshake", () => {
    describe("HTTP long-polling", () => {
      it("successfully opens a session", async () => {
        const response = await fetch(
          `${URL}/engine.io/?EIO=4&transport=polling`
        );

        expect(response.status).to.eql(200);

        const content = await response.text();

        expect(content).to.startsWith("0");

        const value = JSON.parse(content.substring(1));

        expect(value).to.have.all.keys(
          "sid",
          "upgrades",
          "pingInterval",
          "pingTimeout",
          "maxPayload"
        );
        expect(value.sid).to.be.a("string");
        expect(value.upgrades).to.eql(["websocket"]);
        expect(value.pingInterval).to.eql(PING_INTERVAL);
        expect(value.pingTimeout).to.eql(PING_TIMEOUT);
        expect(value.maxPayload).to.eql(1000000);
      });

      it("fails with an invalid 'EIO' query parameter", async () => {
        const response = await fetch(`${URL}/engine.io/?transport=polling`);

        expect(response.status).to.eql(400);

        const response2 = await fetch(
          `${URL}/engine.io/?EIO=abc&transport=polling`
        );

        expect(response2.status).to.eql(400);
      });

      it("fails with an invalid 'transport' query parameter", async () => {
        const response = await fetch(`${URL}/engine.io/?EIO=4`);

        expect(response.status).to.eql(400);

        const response2 = await fetch(`${URL}/engine.io/?EIO=4&transport=abc`);

        expect(response2.status).to.eql(400);
      });

      it("fails with an invalid request method", async () => {
        const response = await fetch(
          `${URL}/engine.io/?EIO=4&transport=polling`,
          {
            method: "post",
          }
        );

        expect(response.status).to.eql(400);

        const response2 = await fetch(
          `${URL}/engine.io/?EIO=4&transport=polling`,
          {
            method: "put",
          }
        );

        expect(response2.status).to.eql(400);
      });
    });

    describe("WebSocket", () => {
      it("successfully opens a session", async () => {
        const socket = new WebSocket(
          `${WS_URL}/engine.io/?EIO=4&transport=websocket`
        );

        const { data } = await waitFor(socket, "message");

        expect(data).to.startsWith("0");

        const value = JSON.parse(data.substring(1));

        expect(value).to.have.all.keys(
          "sid",
          "upgrades",
          "pingInterval",
          "pingTimeout",
          "maxPayload"
        );
        expect(value.sid).to.be.a("string");
        expect(value.upgrades).to.eql([]);
        expect(value.pingInterval).to.eql(PING_INTERVAL);
        expect(value.pingTimeout).to.eql(PING_TIMEOUT);
        expect(value.maxPayload).to.eql(1000000);

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
        const socket = new WebSocket(`${WS_URL}/engine.io/?EIO=4`);

        if (isNodejs) {
          socket.on("error", () => {});
        }

        waitFor(socket, "close");

        const socket2 = new WebSocket(
          `${WS_URL}/engine.io/?EIO=4&transport=abc`
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
          `${URL}/engine.io/?EIO=4&transport=polling&sid=${sid}`,
          {
            method: "post",
            body: "4hello",
          }
        );

        expect(pushResponse.status).to.eql(200);

        const postContent = await pushResponse.text();

        expect(postContent).to.eql("ok");

        const pollResponse = await fetch(
          `${URL}/engine.io/?EIO=4&transport=polling&sid=${sid}`
        );

        expect(pollResponse.status).to.eql(200);

        const pollContent = await pollResponse.text();

        expect(pollContent).to.eql("4hello");
      });

      it("sends and receives a payload containing several plain text packets", async () => {
        const sid = await initLongPollingSession();

        const pushResponse = await fetch(
          `${URL}/engine.io/?EIO=4&transport=polling&sid=${sid}`,
          {
            method: "post",
            body: "4test1\x1e4test2\x1e4test3",
          }
        );

        expect(pushResponse.status).to.eql(200);

        const postContent = await pushResponse.text();

        expect(postContent).to.eql("ok");

        const pollResponse = await fetch(
          `${URL}/engine.io/?EIO=4&transport=polling&sid=${sid}`
        );

        expect(pollResponse.status).to.eql(200);

        const pollContent = await pollResponse.text();

        expect(pollContent).to.eql("4test1\x1e4test2\x1e4test3");
      });

      it("sends and receives a payload containing plain text and binary packets", async () => {
        const sid = await initLongPollingSession();

        const pushResponse = await fetch(
          `${URL}/engine.io/?EIO=4&transport=polling&sid=${sid}`,
          {
            method: "post",
            body: "4hello\x1ebAQIDBA==",
          }
        );

        expect(pushResponse.status).to.eql(200);

        const postContent = await pushResponse.text();

        expect(postContent).to.eql("ok");

        const pollResponse = await fetch(
          `${URL}/engine.io/?EIO=4&transport=polling&sid=${sid}`
        );

        expect(pollResponse.status).to.eql(200);

        const pollContent = await pollResponse.text();

        expect(pollContent).to.eql("4hello\x1ebAQIDBA==");
      });

      it("closes the session upon invalid packet format", async () => {
        const sid = await initLongPollingSession();

        try {
          const pushResponse = await fetch(
            `${URL}/engine.io/?EIO=4&transport=polling&sid=${sid}`,
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
          `${URL}/engine.io/?EIO=4&transport=polling&sid=${sid}`
        );

        expect(pollResponse.status).to.eql(400);
      });

      it("closes the session upon duplicate poll requests", async () => {
        const sid = await initLongPollingSession();

        const pollResponses = await Promise.all([
          fetch(`${URL}/engine.io/?EIO=4&transport=polling&sid=${sid}`),
          sleep(5).then(() => fetch(`${URL}/engine.io/?EIO=4&transport=polling&sid=${sid}&t=burst`)),
        ]);

        expect(pollResponses[0].status).to.eql(200);

        const content = await pollResponses[0].text();

        expect(content).to.eql("1");

        // the Node.js implementation uses HTTP 500 (Internal Server Error), but HTTP 400 seems more suitable
        expect(pollResponses[1].status).to.be.oneOf([400, 500]);

        const pollResponse = await fetch(
          `${URL}/engine.io/?EIO=4&transport=polling&sid=${sid}`
        );

        expect(pollResponse.status).to.eql(400);
      });
    });

    describe("WebSocket", () => {
      it("sends and receives a plain text packet", async () => {
        const socket = new WebSocket(
          `${WS_URL}/engine.io/?EIO=4&transport=websocket`
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
          `${WS_URL}/engine.io/?EIO=4&transport=websocket`
        );
        socket.binaryType = "arraybuffer";

        await waitFor(socket, "message"); // handshake

        socket.send(Uint8Array.from([1, 2, 3, 4]));

        const { data } = await waitFor(socket, "message");

        expect(data).to.eql(Uint8Array.from([1, 2, 3, 4]).buffer);

        socket.close();
      });

      it("closes the session upon invalid packet format", async () => {
        const socket = new WebSocket(
          `${WS_URL}/engine.io/?EIO=4&transport=websocket`
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
          const pollResponse = await fetch(
            `${URL}/engine.io/?EIO=4&transport=polling&sid=${sid}`
          );

          expect(pollResponse.status).to.eql(200);

          const pollContent = await pollResponse.text();

          expect(pollContent).to.eql("2");

          const pushResponse = await fetch(
            `${URL}/engine.io/?EIO=4&transport=polling&sid=${sid}`,
            {
              method: "post",
              body: "3",
            }
          );

          expect(pushResponse.status).to.eql(200);
        }
      });

      it("closes the session upon ping timeout", async () => {
        const sid = await initLongPollingSession();

        await sleep(PING_INTERVAL + PING_TIMEOUT);

        const pollResponse = await fetch(
          `${URL}/engine.io/?EIO=4&transport=polling&sid=${sid}`
        );

        expect(pollResponse.status).to.eql(400);
      });
    });

    describe("WebSocket", () => {
      it("sends ping/pong packets", async () => {
        const socket = new WebSocket(
          `${WS_URL}/engine.io/?EIO=4&transport=websocket`
        );

        await waitFor(socket, "message"); // handshake

        for (let i = 0; i < 3; i++) {
          const { data } = await waitFor(socket, "message");

          expect(data).to.eql("2");

          socket.send("3");
        }

        socket.close();
      });

      it("closes the session upon ping timeout", async () => {
        const socket = new WebSocket(
          `${WS_URL}/engine.io/?EIO=4&transport=websocket`
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
          fetch(`${URL}/engine.io/?EIO=4&transport=polling&sid=${sid}`),
          fetch(`${URL}/engine.io/?EIO=4&transport=polling&sid=${sid}`, {
            method: "post",
            body: "1",
          }),
        ]);

        expect(pollResponse.status).to.eql(200);

        const pullContent = await pollResponse.text();

        expect(pullContent).to.eql("6");

        const pollResponse2 = await fetch(
          `${URL}/engine.io/?EIO=4&transport=polling&sid=${sid}`
        );

        expect(pollResponse2.status).to.eql(400);
      });
    });

    describe("WebSocket", () => {
      it("forcefully closes the session", async () => {
        const socket = new WebSocket(
          `${WS_URL}/engine.io/?EIO=4&transport=websocket`
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
        `${WS_URL}/engine.io/?EIO=4&transport=websocket&sid=${sid}`
      );

      await waitFor(socket, "open");

      // send probe
      socket.send("2probe");

      const probeResponse = await waitFor(socket, "message");

      expect(probeResponse.data).to.eql("3probe");

      const pollResponse = await fetch(
        `${URL}/engine.io/?EIO=4&transport=polling&sid=${sid}`
      );

      expect(pollResponse.status).to.eql(200);

      const pollContent = await pollResponse.text();

      expect(pollContent).to.eql("6"); // "noop" packet to cleanly end the HTTP long-polling request

      // complete upgrade
      socket.send("5");

      socket.send("4hello");

      const { data } = await waitFor(socket, "message");

      expect(data).to.eql("4hello");
    });

    it("ignores HTTP requests with same sid after upgrade", async () => {
      const sid = await initLongPollingSession();

      const socket = new WebSocket(
        `${WS_URL}/engine.io/?EIO=4&transport=websocket&sid=${sid}`
      );

      await waitFor(socket, "open");
      socket.send("2probe");
      socket.send("5");

      const pollResponse = await fetch(
        `${URL}/engine.io/?EIO=4&transport=polling&sid=${sid}`
      );

      expect(pollResponse.status).to.eql(400);

      socket.send("4hello");

      const { data } = await waitFor(socket, "message");

      expect(data).to.eql("4hello");
    });

    it("ignores WebSocket connection with same sid after upgrade", async () => {
      const sid = await initLongPollingSession();

      const socket = new WebSocket(
        `${WS_URL}/engine.io/?EIO=4&transport=websocket&sid=${sid}`
      );

      await waitFor(socket, "open");
      socket.send("2probe");
      socket.send("5");

      const socket2 = new WebSocket(
        `${WS_URL}/engine.io/?EIO=4&transport=websocket&sid=${sid}`
      );

      await waitFor(socket2, "close");

      socket.send("4hello");

      const { data } = await waitFor(socket, "message");

      expect(data).to.eql("4hello");
    });
  });
});
