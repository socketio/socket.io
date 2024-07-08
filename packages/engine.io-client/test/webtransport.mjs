import { Http3Server, WebTransport } from "@fails-components/webtransport";
import { Http3EventLoop } from "@fails-components/webtransport/lib/event-loop.js";
import expect from "expect.js";
import { Server } from "engine.io";
import { Socket } from "../build/esm-debug/index.js";
import { generateWebTransportCertificate } from "./util-wt.mjs";
import { createServer } from "http";
import { TransformStream } from "stream/web";

if (typeof window === "undefined") {
  global.WebTransport = WebTransport;
  global.TransformStream = TransformStream;
}

async function setup(opts, cb) {
  const certificate = await generateWebTransportCertificate(
    [{ shortName: "CN", value: "localhost" }],
    {
      days: 14, // the total length of the validity period MUST NOT exceed two weeks (https://w3c.github.io/webtransport/#custom-certificate-requirements)
    }
  );

  const engine = new Server(opts);

  const h3Server = new Http3Server({
    port: 0,
    host: "0.0.0.0",
    secret: "changeit",
    cert: certificate.cert,
    privKey: certificate.private,
  });

  (async () => {
    try {
      const stream = await h3Server.sessionStream("/engine.io/");
      const sessionReader = stream.getReader();

      while (true) {
        const { done, value } = await sessionReader.read();
        if (done) {
          break;
        }
        engine.onWebTransportSession(value);
      }
    } catch (ex) {
      console.error("Server error", ex);
    }
  })();

  h3Server.startServer();
  h3Server.onServerListening = () => cb({ engine, h3Server, certificate });
}

function success(engine, h3server, done) {
  engine.close();
  h3server.stopServer();
  done();
}

function createSocket(port, certificate, opts) {
  return new Socket(
    `http://127.0.0.1:${port}`,
    Object.assign(
      {
        transportOptions: {
          webtransport: {
            serverCertificateHashes: [
              {
                algorithm: "sha-256",
                value: certificate.hash,
              },
            ],
          },
        },
      },
      opts
    )
  );
}

describe("WebTransport", () => {
  after(() => {
    Http3EventLoop.globalLoop.shutdownEventLoop(); // manually shutdown the event loop, instead of waiting 20s
  });

  it("should allow to connect with WebTransport directly", (done) => {
    setup({}, ({ engine, h3Server, certificate }) => {
      const socket = createSocket(h3Server.port, certificate, {
        transports: ["webtransport"],
      });

      socket.on("open", () => {
        success(engine, h3Server, done);
      });
    });
  });

  it("should allow to upgrade to WebTransport", (done) => {
    setup(
      {
        transports: ["polling", "webtransport"],
      },
      ({ engine, h3Server, certificate }) => {
        const httpServer = createServer();
        engine.attach(httpServer);
        httpServer.listen(h3Server.port);

        const socket = createSocket(h3Server.port, certificate, {
          transports: ["polling", "webtransport"],
        });

        socket.on("upgrade", () => {
          httpServer.close();
          success(engine, h3Server, done);
        });
      }
    );
  });

  it("should favor WebTransport over WebSocket", (done) => {
    setup(
      {
        transports: ["polling", "websocket", "webtransport"],
      },
      ({ engine, h3Server, certificate }) => {
        const httpServer = createServer();
        engine.attach(httpServer);
        httpServer.listen(h3Server.port);

        const socket = createSocket(h3Server.port, certificate, {
          transports: ["polling", "websocket", "webtransport"],
        });

        socket.on("upgrade", (transport) => {
          expect(transport.name).to.eql("webtransport");

          httpServer.close();
          success(engine, h3Server, done);
        });
      }
    );
  });

  it("should send ping/pong packets", (done) => {
    setup(
      {
        pingInterval: 20,
      },
      ({ engine, h3Server, certificate }) => {
        const socket = createSocket(h3Server.port, certificate, {
          transports: ["webtransport"],
        });

        let i = 0;

        socket.on("heartbeat", () => {
          i++;

          if (i === 10) {
            success(engine, h3Server, done);
          }
        });
      }
    );
  });

  it("should handle connections closed by the server", (done) => {
    setup({}, ({ engine, h3Server, certificate }) => {
      const socket = createSocket(h3Server.port, certificate, {
        transports: ["webtransport"],
      });

      engine.on("connection", (serverSocket) => {
        serverSocket.close();
      });

      socket.on("close", (reason) => {
        expect(reason).to.eql("transport close");

        success(engine, h3Server, done);
      });
    });
  });

  it("should handle connections closed by the client", (done) => {
    setup({}, ({ engine, h3Server, certificate }) => {
      const socket = createSocket(h3Server.port, certificate, {
        transports: ["webtransport"],
      });

      engine.on("connection", (serverSocket) => {
        serverSocket.on("close", (reason) => {
          expect(reason).to.eql("transport close");

          success(engine, h3Server, done);
        });
      });

      socket.on("open", () => {
        socket.close();
      });
    });
  });

  it("should send some plaintext data (client to server)", (done) => {
    setup({}, ({ engine, h3Server, certificate }) => {
      const socket = createSocket(h3Server.port, certificate, {
        transports: ["webtransport"],
      });

      engine.on("connection", (serverSocket) => {
        serverSocket.on("message", (data) => {
          expect(data).to.eql("hello");

          success(engine, h3Server, done);
        });
      });

      socket.on("open", () => {
        socket.send("hello");
      });
    });
  });

  it("should send some plaintext data (server to client)", (done) => {
    setup({}, ({ engine, h3Server, certificate }) => {
      const socket = createSocket(h3Server.port, certificate, {
        transports: ["webtransport"],
      });

      engine.on("connection", (serverSocket) => {
        serverSocket.send("hello");
      });

      socket.on("message", (data) => {
        expect(data).to.eql("hello");

        success(engine, h3Server, done);
      });
    });
  });

  it("should send some binary data (client to server)", (done) => {
    setup({}, ({ engine, h3Server, certificate }) => {
      const socket = createSocket(h3Server.port, certificate, {
        transports: ["webtransport"],
      });

      engine.on("connection", (serverSocket) => {
        serverSocket.on("message", (data) => {
          expect(data).to.eql(Uint8Array.from([1, 2, 3]));

          success(engine, h3Server, done);
        });
      });

      socket.on("open", () => {
        socket.send(Uint8Array.from([1, 2, 3]));
      });
    });
  });

  it("should send some binary data (server to client) (as ArrayBuffer)", (done) => {
    setup({}, ({ engine, h3Server, certificate }) => {
      const socket = createSocket(h3Server.port, certificate, {
        transports: ["webtransport"],
      });

      socket.binaryType = "arraybuffer";

      engine.on("connection", (serverSocket) => {
        serverSocket.send(Uint8Array.from([1, 2, 3]));
      });

      socket.on("message", (data) => {
        expect(data).to.be.an(ArrayBuffer);
        expect(new Uint8Array(data)).to.eql(Uint8Array.of(1, 2, 3));

        success(engine, h3Server, done);
      });
    });
  });

  it("should send some binary data (server to client) (as Buffer)", (done) => {
    setup({}, ({ engine, h3Server, certificate }) => {
      const socket = createSocket(h3Server.port, certificate, {
        transports: ["webtransport"],
      });

      engine.on("connection", (serverSocket) => {
        serverSocket.send(Uint8Array.from([1, 2, 3]));
      });

      socket.on("message", (data) => {
        expect(Buffer.isBuffer(data)).to.be(true);
        expect(data).to.eql(Uint8Array.of(1, 2, 3));

        success(engine, h3Server, done);
      });
    });
  });
});
