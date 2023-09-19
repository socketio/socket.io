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

function waitForPackets(socket, count) {
  const packets = [];

  return new Promise((resolve) => {
    const handler = (event) => {
      if (event.data === "2") {
        // ignore PING packets
        return;
      }
      packets.push(event.data);
      if (packets.length === count) {
        socket.removeEventListener("message", handler);
        resolve(packets);
      }
    };
    socket.addEventListener("message", handler);
  });
}

async function initLongPollingSession() {
  const response = await fetch(`${URL}/socket.io/?EIO=4&transport=polling`);
  const content = await response.text();
  return JSON.parse(content.substring(1)).sid;
}

async function initSocketIOConnection() {
  const socket = new WebSocket(
    `${WS_URL}/socket.io/?EIO=4&transport=websocket`
  );
  socket.binaryType = "arraybuffer";

  await waitFor(socket, "message"); // Engine.IO handshake

  socket.send("40");

  await waitFor(socket, "message"); // Socket.IO handshake
  await waitFor(socket, "message"); // "auth" packet

  return socket;
}

describe("Engine.IO protocol", () => {
  describe("handshake", () => {
    describe("HTTP long-polling", () => {
      it("should successfully open a session", async () => {
        const response = await fetch(
          `${URL}/socket.io/?EIO=4&transport=polling`
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

      it("should fail with an invalid 'EIO' query parameter", async () => {
        const response = await fetch(`${URL}/socket.io/?transport=polling`);

        expect(response.status).to.eql(400);

        const response2 = await fetch(
          `${URL}/socket.io/?EIO=abc&transport=polling`
        );

        expect(response2.status).to.eql(400);
      });

      it("should fail with an invalid 'transport' query parameter", async () => {
        const response = await fetch(`${URL}/socket.io/?EIO=4`);

        expect(response.status).to.eql(400);

        const response2 = await fetch(`${URL}/socket.io/?EIO=4&transport=abc`);

        expect(response2.status).to.eql(400);
      });

      it("should fail with an invalid request method", async () => {
        const response = await fetch(
          `${URL}/socket.io/?EIO=4&transport=polling`,
          {
            method: "post",
          }
        );

        expect(response.status).to.eql(400);

        const response2 = await fetch(
          `${URL}/socket.io/?EIO=4&transport=polling`,
          {
            method: "put",
          }
        );

        expect(response2.status).to.eql(400);
      });
    });

    describe("WebSocket", () => {
      it("should successfully open a session", async () => {
        const socket = new WebSocket(
          `${WS_URL}/socket.io/?EIO=4&transport=websocket`
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

      it("should fail with an invalid 'EIO' query parameter", async () => {
        const socket = new WebSocket(
          `${WS_URL}/socket.io/?transport=websocket`
        );

        if (isNodejs) {
          socket.on("error", () => {});
        }

        waitFor(socket, "close");

        const socket2 = new WebSocket(
          `${WS_URL}/socket.io/?EIO=abc&transport=websocket`
        );

        if (isNodejs) {
          socket2.on("error", () => {});
        }

        waitFor(socket2, "close");
      });

      it("should fail with an invalid 'transport' query parameter", async () => {
        const socket = new WebSocket(`${WS_URL}/socket.io/?EIO=4`);

        if (isNodejs) {
          socket.on("error", () => {});
        }

        waitFor(socket, "close");

        const socket2 = new WebSocket(
          `${WS_URL}/socket.io/?EIO=4&transport=abc`
        );

        if (isNodejs) {
          socket2.on("error", () => {});
        }

        waitFor(socket2, "close");
      });
    });
  });

  describe("heartbeat", function () {
    this.timeout(5000);

    describe("HTTP long-polling", () => {
      it("should send ping/pong packets", async () => {
        const sid = await initLongPollingSession();

        for (let i = 0; i < 3; i++) {
          const pollResponse = await fetch(
            `${URL}/socket.io/?EIO=4&transport=polling&sid=${sid}`
          );

          expect(pollResponse.status).to.eql(200);

          const pollContent = await pollResponse.text();

          expect(pollContent).to.eql("2");

          const pushResponse = await fetch(
            `${URL}/socket.io/?EIO=4&transport=polling&sid=${sid}`,
            {
              method: "post",
              body: "3",
            }
          );

          expect(pushResponse.status).to.eql(200);
        }
      });

      it("should close the session upon ping timeout", async () => {
        const sid = await initLongPollingSession();

        await sleep(PING_INTERVAL + PING_TIMEOUT);

        const pollResponse = await fetch(
          `${URL}/socket.io/?EIO=4&transport=polling&sid=${sid}`
        );

        expect(pollResponse.status).to.eql(400);
      });
    });

    describe("WebSocket", () => {
      it("should send ping/pong packets", async () => {
        const socket = new WebSocket(
          `${WS_URL}/socket.io/?EIO=4&transport=websocket`
        );

        await waitFor(socket, "message"); // handshake

        for (let i = 0; i < 3; i++) {
          const { data } = await waitFor(socket, "message");

          expect(data).to.eql("2");

          socket.send("3");
        }

        socket.close();
      });

      it("should close the session upon ping timeout", async () => {
        const socket = new WebSocket(
          `${WS_URL}/socket.io/?EIO=4&transport=websocket`
        );

        await waitFor(socket, "close"); // handshake
      });
    });
  });

  describe("close", () => {
    describe("HTTP long-polling", () => {
      it("should forcefully close the session", async () => {
        const sid = await initLongPollingSession();

        const [pollResponse] = await Promise.all([
          fetch(`${URL}/socket.io/?EIO=4&transport=polling&sid=${sid}`),
          fetch(`${URL}/socket.io/?EIO=4&transport=polling&sid=${sid}`, {
            method: "post",
            body: "1",
          }),
        ]);

        expect(pollResponse.status).to.eql(200);

        const pullContent = await pollResponse.text();

        expect(pullContent).to.eql("6");

        const pollResponse2 = await fetch(
          `${URL}/socket.io/?EIO=4&transport=polling&sid=${sid}`
        );

        expect(pollResponse2.status).to.eql(400);
      });
    });

    describe("WebSocket", () => {
      it("should forcefully close the session", async () => {
        const socket = new WebSocket(
          `${WS_URL}/socket.io/?EIO=4&transport=websocket`
        );

        await waitFor(socket, "message"); // handshake

        socket.send("1");

        await waitFor(socket, "close");
      });
    });
  });

  describe("upgrade", () => {
    it("should successfully upgrade from HTTP long-polling to WebSocket", async () => {
      const sid = await initLongPollingSession();

      const socket = new WebSocket(
        `${WS_URL}/socket.io/?EIO=4&transport=websocket&sid=${sid}`
      );

      await waitFor(socket, "open");

      // send probe
      socket.send("2probe");

      const probeResponse = await waitFor(socket, "message");

      expect(probeResponse.data).to.eql("3probe");

      // complete upgrade
      socket.send("5");
    });

    it("should ignore HTTP requests with same sid after upgrade", async () => {
      const sid = await initLongPollingSession();

      const socket = new WebSocket(
        `${WS_URL}/socket.io/?EIO=4&transport=websocket&sid=${sid}`
      );

      await waitFor(socket, "open");
      socket.send("2probe");
      socket.send("5");

      const pollResponse = await fetch(
        `${URL}/socket.io/?EIO=4&transport=polling&sid=${sid}`
      );

      expect(pollResponse.status).to.eql(400);
    });

    it("should ignore WebSocket connection with same sid after upgrade", async () => {
      const sid = await initLongPollingSession();

      const socket = new WebSocket(
        `${WS_URL}/socket.io/?EIO=4&transport=websocket&sid=${sid}`
      );

      await waitFor(socket, "open");
      socket.send("2probe");
      socket.send("5");

      const socket2 = new WebSocket(
        `${WS_URL}/socket.io/?EIO=4&transport=websocket&sid=${sid}`
      );

      await waitFor(socket2, "close");
    });
  });
});

describe("Socket.IO protocol", () => {
  describe("connect", () => {
    it("should allow connection to the main namespace", async () => {
      const socket = new WebSocket(
        `${WS_URL}/socket.io/?EIO=4&transport=websocket`
      );

      await waitFor(socket, "message"); // Engine.IO handshake

      socket.send("40");

      const { data } = await waitFor(socket, "message");

      expect(data).to.startsWith("40");

      const handshake = JSON.parse(data.substring(2));

      expect(handshake).to.have.all.keys("sid");
      expect(handshake.sid).to.be.a("string");

      const authPacket = await waitFor(socket, "message");

      expect(authPacket.data).to.eql('42["auth",{}]');
    });

    it("should allow connection to the main namespace with a payload", async () => {
      const socket = new WebSocket(
        `${WS_URL}/socket.io/?EIO=4&transport=websocket`
      );

      await waitFor(socket, "message"); // Engine.IO handshake

      socket.send('40{"token":"123"}');

      const { data } = await waitFor(socket, "message");

      expect(data).to.startsWith("40");

      const handshake = JSON.parse(data.substring(2));

      expect(handshake).to.have.all.keys("sid");
      expect(handshake.sid).to.be.a("string");

      const authPacket = await waitFor(socket, "message");

      expect(authPacket.data).to.eql('42["auth",{"token":"123"}]');
    });

    it("should allow connection to a custom namespace", async () => {
      const socket = new WebSocket(
        `${WS_URL}/socket.io/?EIO=4&transport=websocket`
      );

      await waitFor(socket, "message"); // Engine.IO handshake

      socket.send("40/custom,");

      const { data } = await waitFor(socket, "message");

      expect(data).to.startsWith("40/custom,");

      const handshake = JSON.parse(data.substring(10));

      expect(handshake).to.have.all.keys("sid");
      expect(handshake.sid).to.be.a("string");

      const authPacket = await waitFor(socket, "message");

      expect(authPacket.data).to.eql('42/custom,["auth",{}]');
    });

    it("should allow connection to a custom namespace with a payload", async () => {
      const socket = new WebSocket(
        `${WS_URL}/socket.io/?EIO=4&transport=websocket`
      );

      await waitFor(socket, "message"); // Engine.IO handshake

      socket.send('40/custom,{"token":"abc"}');

      const { data } = await waitFor(socket, "message");

      expect(data).to.startsWith("40/custom,");

      const handshake = JSON.parse(data.substring(10));

      expect(handshake).to.have.all.keys("sid");
      expect(handshake.sid).to.be.a("string");

      const authPacket = await waitFor(socket, "message");

      expect(authPacket.data).to.eql('42/custom,["auth",{"token":"abc"}]');
    });

    it("should disallow connection to an unknown namespace", async () => {
      const socket = new WebSocket(
        `${WS_URL}/socket.io/?EIO=4&transport=websocket`
      );

      await waitFor(socket, "message"); // Engine.IO handshake

      socket.send("40/random");

      const { data } = await waitFor(socket, "message");

      expect(data).to.eql('44/random,{"message":"Invalid namespace"}');
    });

    it("should disallow connection with an invalid handshake", async () => {
      const socket = new WebSocket(
        `${WS_URL}/socket.io/?EIO=4&transport=websocket`
      );

      await waitFor(socket, "message"); // Engine.IO handshake

      socket.send("4abc");

      await waitFor(socket, "close");
    });

    
    it("should close the connection if no handshake is received", async () => {
      const socket = new WebSocket(
          `${WS_URL}/socket.io/?EIO=4&transport=websocket`
      );

      await waitFor(socket, "close");
    });
  });

  describe("disconnect", () => {
    it("should disconnect from the main namespace", async () => {
      const socket = await initSocketIOConnection();

      socket.send("41");

      const { data } = await waitFor(socket, "message");

      expect(data).to.eql("2");
    });

    it("should connect then disconnect from a custom namespace", async () => {
      const socket = await initSocketIOConnection();

      await waitFor(socket, "message"); // ping

      socket.send("40/custom");

      await waitFor(socket, "message"); // Socket.IO handshake
      await waitFor(socket, "message"); // auth packet

      socket.send("41/custom");
      socket.send('42["message","message to main namespace"]');

      const { data } = await waitFor(socket, "message");

      expect(data).to.eql('42["message-back","message to main namespace"]');
    });
  });

  describe("message", () => {
    it("should send a plain-text packet", async () => {
      const socket = await initSocketIOConnection();

      socket.send('42["message",1,"2",{"3":[true]}]');

      const { data } = await waitFor(socket, "message");

      expect(data).to.eql('42["message-back",1,"2",{"3":[true]}]');
    });

    it("should send a packet with binary attachments", async () => {
      const socket = await initSocketIOConnection();

      socket.send(
        '452-["message",{"_placeholder":true,"num":0},{"_placeholder":true,"num":1}]'
      );
      socket.send(Uint8Array.from([1, 2, 3]));
      socket.send(Uint8Array.from([4, 5, 6]));

      const packets = await waitForPackets(socket, 3);

      expect(packets[0]).to.eql(
        '452-["message-back",{"_placeholder":true,"num":0},{"_placeholder":true,"num":1}]'
      );
      expect(packets[1]).to.eql(Uint8Array.from([1, 2, 3]).buffer);
      expect(packets[2]).to.eql(Uint8Array.from([4, 5, 6]).buffer);

      socket.close();
    });

    it("should send a plain-text packet with an ack", async () => {
      const socket = await initSocketIOConnection();

      socket.send('42456["message-with-ack",1,"2",{"3":[false]}]');

      const { data } = await waitFor(socket, "message");

      expect(data).to.eql('43456[1,"2",{"3":[false]}]');
    });

    it("should send a packet with binary attachments and an ack", async () => {
      const socket = await initSocketIOConnection();

      socket.send(
        '452-789["message-with-ack",{"_placeholder":true,"num":0},{"_placeholder":true,"num":1}]'
      );
      socket.send(Uint8Array.from([1, 2, 3]));
      socket.send(Uint8Array.from([4, 5, 6]));

      const packets = await waitForPackets(socket, 3);

      expect(packets[0]).to.eql(
        '462-789[{"_placeholder":true,"num":0},{"_placeholder":true,"num":1}]'
      );
      expect(packets[1]).to.eql(Uint8Array.from([1, 2, 3]).buffer);
      expect(packets[2]).to.eql(Uint8Array.from([4, 5, 6]).buffer);

      socket.close();
    });

    it("should close the connection upon invalid format (unknown packet type)", async () => {
      const socket = await initSocketIOConnection();

      socket.send("4abc");

      await waitFor(socket, "close");
    });

    it("should close the connection upon invalid format (invalid payload format)", async () => {
      const socket = await initSocketIOConnection();

      socket.send("42{}");

      await waitFor(socket, "close");
    });

    it("should close the connection upon invalid format (invalid ack id)", async () => {
      const socket = await initSocketIOConnection();

      socket.send('42abc["message-with-ack",1,"2",{"3":[false]}]');

      await waitFor(socket, "close");
    });
  });
});
