import * as eio from "../build/server.js";
import { Http3Server, WebTransport } from "@fails-components/webtransport";
import { Http3EventLoop } from "@fails-components/webtransport/lib/event-loop.js";
import expect from "expect.js";
import request from "superagent";
import { createServer } from "http";
import { generateWebTransportCertificate } from "./util.mjs";

const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

function success(engine, h3server, done) {
  engine.close();
  h3server.stopServer();
  done();
}

function createPartialDone(done, count) {
  let i = 0;
  return () => {
    if (++i === count) {
      done();
    } else if (i > count) {
      done(new Error(`partialDone() called too many times: ${i} > ${count}`));
    }
  };
}

async function setupServer(opts, cb) {
  const certificate = await generateWebTransportCertificate(
    [{ shortName: "CN", value: "localhost" }],
    {
      days: 14, // the total length of the validity period MUST NOT exceed two weeks (https://w3c.github.io/webtransport/#custom-certificate-requirements)
    }
  );

  const engine = new eio.Server(opts);

  const h3Server = new Http3Server({
    port: 0, // random port
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

function setup(opts, cb) {
  setupServer(opts, async ({ engine, h3Server, certificate }) => {
    const client = new WebTransport(
      `https://127.0.0.1:${h3Server.port}/engine.io/`,
      {
        serverCertificateHashes: [
          {
            algorithm: "sha-256",
            value: certificate.hash,
          },
        ],
      }
    );

    await client.ready;

    const stream = await client.createBidirectionalStream();
    const reader = stream.readable.getReader();
    const writer = stream.writable.getWriter();

    engine.on("connection", (socket) => {
      cb({ engine, h3Server, socket, client, stream, reader, writer });
    });

    await writer.write(TEXT_ENCODER.encode("0"));
    await reader.read(); // handshake
  });
}

describe("WebTransport", () => {
  after(() => {
    Http3EventLoop.globalLoop.shutdownEventLoop(); // manually shutdown the event loop, instead of waiting 20s
  });

  it("should allow to connect with WebTransport directly", (done) => {
    setupServer({}, async ({ engine, h3Server, certificate }) => {
      const partialDone = createPartialDone(
        () => success(engine, h3Server, done),
        2
      );

      engine.on("connection", (socket) => {
        expect(socket.transport.name).to.eql("webtransport");
        partialDone();
      });

      const client = new WebTransport(
        `https://127.0.0.1:${h3Server.port}/engine.io/`,
        {
          serverCertificateHashes: [
            {
              algorithm: "sha-256",
              value: certificate.hash,
            },
          ],
        }
      );

      await client.ready;

      const stream = await client.createBidirectionalStream();
      const reader = stream.readable.getReader();
      const writer = stream.writable.getWriter();

      (async function read() {
        const { done, value } = await reader.read();

        if (done) {
          return;
        }

        const handshake = TEXT_DECODER.decode(value);
        expect(handshake.startsWith("0{")).to.be(true);

        partialDone();
      })();

      await writer.write(TEXT_ENCODER.encode("0"));
    });
  });

  it("should allow to upgrade to WebTransport", (done) => {
    setupServer(
      {
        transports: ["polling", "websocket", "webtransport"],
      },
      async ({ engine, h3Server, certificate }) => {
        const httpServer = createServer();
        engine.attach(httpServer);
        httpServer.listen(h3Server.port);

        const partialDone = createPartialDone(() => {
          httpServer.close();
          success(engine, h3Server, done);
        }, 2);

        engine.on("connection", (socket) => {
          socket.on("upgrade", (transport) => {
            expect(transport.name).to.eql("webtransport");
            partialDone();
          });
        });

        request(`http://localhost:${h3Server.port}/engine.io/`)
          .query({ EIO: 4, transport: "polling" })
          .end(async (_, res) => {
            const payload = JSON.parse(res.text.substring(1));

            expect(payload.upgrades).to.eql(["websocket", "webtransport"]);

            const client = new WebTransport(
              `https://127.0.0.1:${h3Server.port}/engine.io/`,
              {
                serverCertificateHashes: [
                  {
                    algorithm: "sha-256",
                    value: certificate.hash,
                  },
                ],
              }
            );

            await client.ready;

            const stream = await client.createBidirectionalStream();
            const reader = stream.readable.getReader();
            const writer = stream.writable.getWriter();

            (async function read() {
              const { done, value } = await reader.read();

              if (done) {
                return;
              }

              const probeValue = TEXT_DECODER.decode(value);
              expect(probeValue).to.eql("3probe");

              partialDone();
            })();

            await writer.write(
              TEXT_ENCODER.encode(`0{"sid":"${payload.sid}"}`)
            );
            await writer.write(TEXT_ENCODER.encode(`2probe`));
            await writer.write(TEXT_ENCODER.encode(`5`));
          });
      }
    );
  });

  it("should close a connection that fails to open a bidirectional stream", (done) => {
    setupServer(
      {
        upgradeTimeout: 50,
      },
      async ({ engine, h3Server, certificate }) => {
        const client = new WebTransport(
          `https://127.0.0.1:${h3Server.port}/engine.io/`,
          {
            serverCertificateHashes: [
              {
                algorithm: "sha-256",
                value: certificate.hash,
              },
            ],
          }
        );

        await client.ready;

        client.closed.then(() => {
          success(engine, h3Server, done);
        });
      }
    );
  });

  it("should close a connection that sends an invalid handshake", (done) => {
    setupServer(
      {
        upgradeTimeout: 50,
      },
      async ({ engine, h3Server, certificate }) => {
        const client = new WebTransport(
          `https://127.0.0.1:${h3Server.port}/engine.io/`,
          {
            serverCertificateHashes: [
              {
                algorithm: "sha-256",
                value: certificate.hash,
              },
            ],
          }
        );

        await client.ready;
        const stream = await client.createBidirectionalStream();
        const writer = stream.writable.getWriter();

        await writer.write(Uint8Array.of(1, 2, 3));

        client.closed.then(() => {
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
      async ({ engine, h3Server, reader, writer }) => {
        for (let i = 0; i < 5; i++) {
          const packet = await reader.read();
          const value = TEXT_DECODER.decode(packet.value);
          expect(value).to.eql("2");

          writer.write(TEXT_ENCODER.encode("3"));
        }

        success(engine, h3Server, done);
      }
    );
  });

  it("should close on ping timeout", (done) => {
    setup(
      {
        pingInterval: 20,
        pingTimeout: 30,
      },
      async ({ engine, h3Server, socket, client }) => {
        const partialDone = createPartialDone(done, 2);
        socket.on("close", (reason) => {
          expect(reason).to.eql("ping timeout");
          partialDone();
        });

        client.closed.then(() => success(engine, h3Server, partialDone));
      }
    );
  });

  it("should handle connections closed by the server", (done) => {
    setup({}, async ({ engine, h3Server, socket, client }) => {
      client.closed.then(() => success(engine, h3Server, done));

      socket.close();
    });
  });

  it("should handle connections closed by the client", (done) => {
    setup({}, async ({ engine, h3Server, socket, client }) => {
      socket.on("close", (reason) => {
        expect(reason).to.eql("transport close");
        success(engine, h3Server, done);
      });

      client.close();
    });
  });

  it("should send some plaintext data (client to server)", (done) => {
    setup({}, async ({ engine, h3Server, socket, writer }) => {
      socket.on("data", (data) => {
        expect(data).to.eql("hello");

        success(engine, h3Server, done);
      });

      writer.write(TEXT_ENCODER.encode("4hello"));
    });
  });

  it("should send some plaintext data (server to client)", (done) => {
    setup({}, async ({ engine, h3Server, socket, reader }) => {
      socket.send("hello");

      const { value } = await reader.read();
      const decoded = TEXT_DECODER.decode(value);
      expect(decoded).to.eql("4hello");

      success(engine, h3Server, done);
    });
  });

  it("should send some binary data (client to server)", (done) => {
    setup({}, async ({ engine, h3Server, socket, writer }) => {
      socket.on("data", (data) => {
        expect(Buffer.isBuffer(data)).to.be(true);
        expect(data).to.eql(Buffer.of(1, 2, 3));

        success(engine, h3Server, done);
      });

      writer.write(Uint8Array.of(1, 2, 3));
    });
  });

  it("should send some binary data (server to client)", (done) => {
    setup({}, async ({ engine, h3Server, socket, reader }) => {
      socket.send(Buffer.of(1, 2, 3));

      const { value } = await reader.read();
      expect(value).to.eql(Uint8Array.of(1, 2, 3));

      success(engine, h3Server, done);
    });
  });

  it("should send some binary data (client to server) (with binary flag)", (done) => {
    setup({}, async ({ engine, h3Server, socket, writer }) => {
      socket.on("data", (data) => {
        expect(Buffer.isBuffer(data)).to.be(true);
        expect(data).to.eql(Buffer.of(48, 1, 2, 3));

        success(engine, h3Server, done);
      });

      writer.write(Uint8Array.of(54));
      writer.write(Uint8Array.of(48, 1, 2, 3));
    });
  });

  it("should send some binary data (server to client) (with binary flag)", (done) => {
    setup({}, async ({ engine, h3Server, socket, reader }) => {
      socket.send(Buffer.of(48, 1, 2, 3));

      const header = await reader.read();
      expect(header.value).to.eql(Uint8Array.of(54));

      const { value } = await reader.read();
      expect(value).to.eql(Uint8Array.of(48, 1, 2, 3));

      success(engine, h3Server, done);
    });
  });

  it("should send some binary data (client to server) (binary flag)", (done) => {
    setup({}, async ({ engine, h3Server, socket, writer }) => {
      socket.on("data", (data) => {
        expect(Buffer.isBuffer(data)).to.be(true);
        expect(data).to.eql(Buffer.of(54));

        success(engine, h3Server, done);
      });

      writer.write(Uint8Array.of(54));
      writer.write(Uint8Array.of(54));
    });
  });

  it("should send some binary data (server to client) (binary flag)", (done) => {
    setup({}, async ({ engine, h3Server, socket, reader }) => {
      socket.send(Buffer.of(54));

      const header = await reader.read();
      expect(header.value).to.eql(Uint8Array.of(54));

      const { value } = await reader.read();
      expect(value).to.eql(Uint8Array.of(54));

      success(engine, h3Server, done);
    });
  });
});
