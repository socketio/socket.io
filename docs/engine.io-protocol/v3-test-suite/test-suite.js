const isNodejs = typeof window === "undefined";

if (isNodejs) {
  await import("./node-imports.js");
}

const { expect } = chai;

// Constants
const URL = "http://localhost:3000";
const WS_URL = URL.replace("http", "ws");
const PING_INTERVAL = 300;
const PING_TIMEOUT = 200;
const EIO_VERSION = "3";

// Utility functions
const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay));

const waitFor = (socket, eventType) =>
  new Promise((resolve) => {
    socket.addEventListener(eventType, (event) => resolve(event), { once: true });
  });

const decodePayload = (payload) => {
  const colonIndex = payload.indexOf(":");
  return [payload.substring(0, colonIndex), payload.substring(colonIndex + 1)];
};

const buildEngineUrl = (params = {}) => {
  const searchParams = new URLSearchParams({ EIO: EIO_VERSION, ...params });
  return `${URL}/engine.io/?${searchParams}`;
};

const buildWsEngineUrl = (params = {}) => {
  const searchParams = new URLSearchParams({ EIO: EIO_VERSION, ...params });
  return `${WS_URL}/engine.io/?${searchParams}`;
};

const initLongPollingSession = async (supportsBinary = false) => {
  const params = { transport: "polling" };
  if (!supportsBinary) params.b64 = "1";
  
  const response = await fetch(buildEngineUrl(params));
  const text = await response.text();
  const [, content] = decodePayload(text);
  return JSON.parse(content.substring(1)).sid;
};

const suppressNodeErrors = (socket) => {
  if (isNodejs) socket.on("error", () => {});
};

const expectValidHandshake = (value) => {
  expect(value.sid).to.be.a("string");
  expect(value.pingInterval).to.eql(PING_INTERVAL);
  expect(value.pingTimeout).to.eql(PING_TIMEOUT);
  expect(value.maxPayload).to.be.oneOf([undefined, 1000000]);
};

// Tests
describe("Engine.IO protocol", () => {
  describe("handshake", () => {
    describe("HTTP long-polling", () => {
      it("successfully opens a session", async () => {
        const response = await fetch(buildEngineUrl({ transport: "polling" }));
        expect(response.status).to.eql(200);

        const text = await response.text();
        const [length, content] = decodePayload(text);

        expect(length).to.eql(content.length.toString());
        expect(content).to.startsWith("0");

        const value = JSON.parse(content.substring(1));
        expectValidHandshake(value);
        expect(value.upgrades).to.eql(["websocket"]);
      });

      it("fails with invalid 'transport' query parameter", async () => {
        expect((await fetch(buildEngineUrl())).status).to.eql(400);
        expect((await fetch(buildEngineUrl({ transport: "abc" }))).status).to.eql(400);
      });

      it("fails with invalid request method", async () => {
        const response = await fetch(buildEngineUrl({ transport: "polling" }), { method: "post" });
        expect(response.status).to.eql(400);
      });
    });

    describe("WebSocket", () => {
      it("successfully opens a session", async () => {
        const socket = new WebSocket(buildWsEngineUrl({ transport: "websocket" }));
        const { data } = await waitFor(socket, "message");

        expect(data).to.startsWith("0");
        const value = JSON.parse(data.substring(1));
        expectValidHandshake(value);
        expect(value.upgrades).to.eql([]);

        socket.close();
      });

      it("fails with invalid 'EIO' query parameter", async () => {
        for (const params of [{}, { EIO: "abc" }]) {
          const socket = new WebSocket(`${WS_URL}/engine.io/?transport=websocket&${new URLSearchParams(params)}`);
          suppressNodeErrors(socket);
          waitFor(socket, "close");
        }
      });

      it("fails with invalid 'transport' query parameter", async () => {
        for (const params of [{ EIO: EIO_VERSION }, { EIO: EIO_VERSION, transport: "abc" }]) {
          const socket = new WebSocket(`${WS_URL}/engine.io/?${new URLSearchParams(params)}`);
          suppressNodeErrors(socket);
          waitFor(socket, "close");
        }
      });
    });
  });

  describe("message", () => {
    describe("HTTP long-polling", () => {
      const testPayloadExchange = async (body, expectedResponse) => {
        const sid = await initLongPollingSession();
        const pushResponse = await fetch(buildEngineUrl({ transport: "polling", sid }), {
          method: "post",
          body,
        });
        expect(pushResponse.status).to.eql(200);
        expect(await pushResponse.text()).to.eql("ok");

        const pollResponse = await fetch(buildEngineUrl({ transport: "polling", sid }));
        expect(pollResponse.status).to.eql(200);
        expect(await pollResponse.text()).to.eql(expectedResponse);
      };

      it("sends and receives a plain text packet", () =>
        testPayloadExchange("6:4hello", "6:4hello"));

      it("sends and receives multiple plain text packets", () =>
        testPayloadExchange("6:4test16:4test26:4test3", "6:4test16:4test26:4test3"));

      it("sends and receives mixed text and binary packets (base64)", () =>
        testPayloadExchange("6:4hello10:b4AQIDBA==", "6:4hello10:b4AQIDBA=="));

      it("sends and receives mixed packets (binary)", async () => {
        const sid = await initLongPollingSession(true);
        const pushResponse = await fetch(buildEngineUrl({ transport: "polling", sid }), {
          method: "post",
          body: "6:4hello10:b4AQIDBA==",
        });
        expect(pushResponse.status).to.eql(200);

        const pollResponse = await fetch(buildEngineUrl({ transport: "polling", sid }));
        const buffer = await pollResponse.arrayBuffer();
        expect(buffer).to.eql(
          Uint8Array.from([0, 6, 255, 52, 104, 101, 108, 108, 111, 1, 5, 255, 4, 1, 2, 3, 4]).buffer
        );
      });

      it("closes session upon invalid packet format", async () => {
        const sid = await initLongPollingSession();
        try {
          await fetch(buildEngineUrl({ transport: "polling", sid }), { method: "post", body: "abc" });
        } catch (e) {}

        const pollResponse = await fetch(buildEngineUrl({ transport: "polling", sid }));
        expect(pollResponse.status).to.eql(400);
      });
    });

    describe("WebSocket", () => {
      it("sends and receives a plain text packet", async () => {
        const socket = new WebSocket(buildWsEngineUrl({ transport: "websocket" }));
        await waitFor(socket, "open");
        await waitFor(socket, "message");

        socket.send("4hello");
        const { data } = await waitFor(socket, "message");
        expect(data).to.eql("4hello");
        socket.close();
      });

      it("sends and receives a binary packet", async () => {
        const socket = new WebSocket(buildWsEngineUrl({ transport: "websocket" }));
        socket.binaryType = "arraybuffer";
        await waitFor(socket, "message");

        socket.send(Uint8Array.from([4, 1, 2, 3, 4]));
        const { data } = await waitFor(socket, "message");
        expect(data).to.eql(Uint8Array.from([4, 1, 2, 3, 4]).buffer);
        socket.close();
      });

      it("closes session upon invalid packet format", async () => {
        const socket = new WebSocket(buildWsEngineUrl({ transport: "websocket" }));
        await waitFor(socket, "message");
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
          const pushResponse = await fetch(buildEngineUrl({ transport: "polling", sid }), {
            method: "post",
            body: "1:2",
          });
          expect(pushResponse.status).to.eql(200);

          const pollResponse = await fetch(buildEngineUrl({ transport: "polling", sid }));
          expect(await pollResponse.text()).to.eql("1:3");
        }
      });

      it("closes session upon ping timeout", async () => {
        const sid = await initLongPollingSession();
        await sleep(PING_INTERVAL + PING_TIMEOUT);

        const pushResponse = await fetch(buildEngineUrl({ transport: "polling", sid }), {
          method: "post",
          body: "1:2",
        });
        expect(pushResponse.status).to.eql(400);
      });
    });

    describe("WebSocket", () => {
      it("sends ping/pong packets", async () => {
        const socket = new WebSocket(buildWsEngineUrl({ transport: "websocket" }));
        await waitFor(socket, "message");

        for (let i = 0; i < 3; i++) {
          socket.send("2");
          const { data } = await waitFor(socket, "message");
          expect(data).to.eql("3");
        }
        socket.close();
      });

      it("closes session upon ping timeout", async () => {
        const socket = new WebSocket(buildWsEngineUrl({ transport: "websocket" }));
        await waitFor(socket, "close");
      });
    });
  });

  describe("close", () => {
    describe("HTTP long-polling", () => {
      it("forcefully closes session", async () => {
        const sid = await initLongPollingSession();
        const [pollResponse] = await Promise.all([
          fetch(buildEngineUrl({ transport: "polling", sid })),
          fetch(buildEngineUrl({ transport: "polling", sid }), { method: "post", body: "1:1" }),
        ]);

        expect(pollResponse.status).to.eql(200);
        expect(await pollResponse.text()).to.eql("1:6");

        const pollResponse2 = await fetch(buildEngineUrl({ transport: "polling", sid }));
        expect(pollResponse2.status).to.eql(400);
      });
    });

    describe("WebSocket", () => {
      it("forcefully closes session", async () => {
        const socket = new WebSocket(buildWsEngineUrl({ transport: "websocket" }));
        await waitFor(socket, "message");
        socket.send("1");
        await waitFor(socket, "close");
      });
    });
  });

  describe("upgrade", () => {
    it("upgrades from HTTP long-polling to WebSocket", async () => {
      const sid = await initLongPollingSession();
      const socket = new WebSocket(buildWsEngineUrl({ transport: "websocket", sid }));

      await waitFor(socket, "open");
      socket.send("2probe");
      expect((await waitFor(socket, "message")).data).to.eql("3probe");

      const pollResponse = await fetch(buildEngineUrl({ transport: "polling", sid }));
      expect(await pollResponse.text()).to.eql("1:6");

      socket.send("5");
      socket.send("4hello");
      expect((await waitFor(socket, "message")).data).to.eql("4hello");
    });

    it("ignores HTTP requests with same sid after upgrade", async () => {
      const sid = await initLongPollingSession();
      const socket = new WebSocket(buildWsEngineUrl({ transport: "websocket", sid }));

      await waitFor(socket, "open");
      socket.send("2probe");
      expect((await waitFor(socket, "message")).data).to.eql("3probe");
      socket.send("5");

      const pollResponse = await fetch(buildEngineUrl({ transport: "polling", sid }));
      expect(pollResponse.status).to.eql(400);

      socket.send("4hello");
      expect((await waitFor(socket, "message")).data).to.eql("4hello");
    });

    it("ignores WebSocket connection with same sid after upgrade", async () => {
      const sid = await initLongPollingSession();
      const socket = new WebSocket(buildWsEngineUrl({ transport: "websocket", sid }));

      await waitFor(socket, "open");
      socket.send("2probe");
      expect((await waitFor(socket, "message")).data).to.eql("3probe");
      socket.send("5");

      const socket2 = new WebSocket(buildWsEngineUrl({ transport: "websocket", sid }));
      await waitFor(socket2, "close");

      socket.send("4hello");
      expect((await waitFor(socket, "message")).data).to.eql("4hello");
    });
  });
});
