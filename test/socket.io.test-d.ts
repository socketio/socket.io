"use strict";
import { Namespace, Server, Socket } from "..";
import type { DefaultEventsMap } from "../lib/typed-events";
import { createServer } from "http";
import { expectError, expectNotAssignable, expectType } from "tsd";
import { Adapter } from "socket.io-adapter";
import type { DisconnectReason } from "../lib/socket";

// This file is run by tsd, not mocha.

describe("server", () => {
  describe("no event map", () => {
    describe("on", () => {
      it("infers correct types for listener parameters of reserved events", (done) => {
        const srv = createServer();
        const sio = new Server(srv);
        srv.listen(() => {
          sio.on("connection", (s) => {
            expectType<Socket<DefaultEventsMap, DefaultEventsMap>>(s);
            s.on("disconnect", (reason) => {
              expectType<DisconnectReason>(reason);
            });
            s.on("disconnecting", (reason) => {
              expectType<DisconnectReason>(reason);
            });
          });
          sio.on("connection", (s) => {
            expectType<Socket<DefaultEventsMap, DefaultEventsMap>>(s);
          });
          done();
        });
      });

      it("infers 'any' for listener parameters of other events", (done) => {
        const srv = createServer();
        const sio = new Server(srv);
        srv.listen(() => {
          sio.on("connection", (s) => {
            s.on("random", (a, b, c) => {
              expectType<any>(a);
              expectType<any>(b);
              expectType<any>(c);
              done();
            });
            s.emit("random", 1, "2", [3]);
          });
        });
      });

      it("infers 'any' for listener parameters of other events using enums", () => {
        const srv = createServer();
        const sio = new Server(srv);
        srv.listen(() => {
          sio.on("connection", (socket) => {
            expectType<Socket<DefaultEventsMap, DefaultEventsMap>>(socket);
          });

          enum Events {
            CONNECTION = "connection",
            TEST = "test",
          }

          sio.on(Events.CONNECTION, (socket) => {
            expectType<Socket<DefaultEventsMap, DefaultEventsMap>>(socket);

            socket.on("test", (a, b, c) => {
              expectType<any>(a);
              expectType<any>(b);
              expectType<any>(c);
            });

            socket.on(Events.TEST, (a, b, c) => {
              expectType<any>(a);
              expectType<any>(b);
              expectType<any>(c);
            });
          });
        });
      });
    });

    describe("emit", () => {
      it("accepts any parameters", () => {
        const srv = createServer();
        const sio = new Server(srv);
        srv.listen(() => {
          sio.on("connection", (s) => {
            s.emit("random", 1, "2", [3]);
            s.emit("no parameters");
          });
        });
      });
    });

    describe("emitWithAck", () => {
      it("accepts any parameters", () => {
        const srv = createServer();
        const sio = new Server(srv);
        srv.listen(async () => {
          const value = await sio
            .timeout(1000)
            .emitWithAck("ackFromServerSingleArg", true, "123");
          expectType<any>(value);

          sio.on("connection", async (s) => {
            const value1 = await s.emitWithAck(
              "ackFromServerSingleArg",
              true,
              "123"
            );
            expectType<any>(value1);
          });
        });
      });
    });
  });

  describe("single event map", () => {
    interface BidirectionalEvents {
      random: (a: number, b: string, c: number[]) => void;
    }

    describe("on", () => {
      it("infers correct types for listener parameters", (done) => {
        const srv = createServer();
        const sio = new Server<BidirectionalEvents>(srv);
        expectType<Server<BidirectionalEvents, BidirectionalEvents>>(sio);
        srv.listen(() => {
          sio.on("connection", (s) => {
            expectType<Socket<BidirectionalEvents, BidirectionalEvents>>(s);
            s.on("random", (a, b, c) => {
              expectType<number>(a);
              expectType<string>(b);
              expectType<number[]>(c);
              done();
            });
          });
        });
      });

      it("does not accept arguments of wrong types", (done) => {
        const srv = createServer();
        const sio = new Server<BidirectionalEvents, BidirectionalEvents, {}>(
          srv
        );
        expectError(sio.on("random", (a, b, c) => {}));
        srv.listen(() => {
          expectError(sio.on("wrong name", (s) => {}));
          sio.on("connection", (s) => {
            s.on("random", (a, b, c) => {});
            expectError(s.on("random"));
            expectError(s.on("random", (a, b, c, d) => {}));
            expectError(s.on(2, 3));
          });
        });
      });
    });

    describe("emit", () => {
      it("accepts arguments of the correct types", () => {
        const srv = createServer();
        const sio = new Server<BidirectionalEvents>(srv);
        srv.listen(() => {
          sio.on("connection", (s) => {
            s.emit("random", 1, "2", [3]);
          });
        });
      });

      it("does not accept arguments of the wrong types", () => {
        const srv = createServer();
        const sio = new Server<BidirectionalEvents>(srv);
        srv.listen(() => {
          sio.on("connection", (s) => {
            expectError(s.emit("noParameter", 2));
            expectError(s.emit("oneParameter"));
            expectError(s.emit("random"));
            expectError(s.emit("oneParameter", 2, 3));
            expectError(s.emit("random", (a, b, c) => {}));
            expectError(s.emit("wrong name", () => {}));
            expectError(s.emit("complicated name with spaces", 2));
          });
        });
      });
    });
  });

  describe("listen and emit event maps", () => {
    interface ClientToServerEvents {
      helloFromClient: (message: string) => void;
      ackFromClient: (
        a: string,
        b: number,
        ack: (c: string, d: number) => void
      ) => void;
    }

    interface ServerToClientEvents {
      helloFromServer: (message: string, x: number) => void;
      ackFromServer: (
        a: boolean,
        b: string,
        ack: (c: boolean, d: string) => void
      ) => void;

      ackFromServerSingleArg: (
        a: boolean,
        b: string,
        ack: (c: string) => void
      ) => void;

      multipleAckFromServer: (
        a: boolean,
        b: string,
        ack: (c: string) => void
      ) => void;
    }

    describe("on", () => {
      it("infers correct types for listener parameters", (done) => {
        const srv = createServer();
        const sio = new Server<ClientToServerEvents, ServerToClientEvents>(srv);
        expectType<Server<ClientToServerEvents, ServerToClientEvents>>(sio);
        srv.listen(() => {
          sio.on("connection", (s) => {
            expectType<Socket<ClientToServerEvents, ServerToClientEvents>>(s);
            s.on("helloFromClient", (message) => {
              expectType<string>(message);
              done();
            });

            s.on("ackFromClient", (a, b, cb) => {
              expectType<string>(a);
              expectType<number>(b);
              expectType<(c: string, d: number) => void>(cb);
              cb("123", 456);
            });
          });
        });
      });

      it("does not accept emit events", (done) => {
        const srv = createServer();
        const sio = new Server<ClientToServerEvents, ServerToClientEvents>(srv);
        srv.listen(() => {
          sio.on("connection", (s) => {
            expectError(
              s.on("helloFromServer", (message, number) => {
                done();
              })
            );
          });
        });
      });
    });

    describe("emit", () => {
      it("accepts arguments of the correct types", (done) => {
        const srv = createServer();
        const sio = new Server<ClientToServerEvents, ServerToClientEvents>(srv);
        srv.listen(() => {
          // No Callback
          sio.emit("helloFromServer", "hi", 1);
          sio.to("room").emit("helloFromServer", "hi", 1);
          sio.timeout(1000).emit("helloFromServer", "hi", 1);

          // One arg
          sio.emit("ackFromServerSingleArg", true, "123", (...args) => {
            expectType<[string[]]>(args);
          });
          // One arg + timeout
          sio
            .timeout(1)
            .emit("ackFromServerSingleArg", true, "123", (...args) => {
              expectType<[Error, string[]]>(args);
            });
          // One arg + room
          sio.to("1").emit("ackFromServerSingleArg", true, "123", (...args) => {
            expectType<[string[]]>(args);
          });
          sio.in("1").emit("ackFromServerSingleArg", true, "123", (...args) => {
            expectType<[string[]]>(args);
          });
          sio
            .except("1")
            .emit("ackFromServerSingleArg", true, "123", (...args) => {
              expectType<[string[]]>(args);
            });
          // One arg + timeout + room
          sio
            .timeout(1)
            .in("1")
            .emit("ackFromServerSingleArg", true, "123", (...args) => {
              expectType<[Error, string[]]>(args);
            });
          // One arg + timeout + room + timeout + room
          sio
            .timeout(1)
            .to("1")
            .timeout(1)
            .to("1")
            .emit("ackFromServerSingleArg", true, "123", (...args) => {
              expectType<[Error, string[]]>(args);
            });

          // Two args
          sio.emit("ackFromServer", true, "123", (...args) => {
            expectType<[boolean[], string[]]>(args);
          });
          // Two args + timeout
          sio.timeout(1).emit("ackFromServer", true, "123", (...args) => {
            expectType<[Error, boolean[], string[]]>(args);
          });
          // Two args + room
          sio.to("1").emit("ackFromServer", true, "123", (...args) => {
            expectType<[boolean[], string[]]>(args);
          });
          // Two args + timeout + room
          sio
            .timeout(1)
            .in("1")
            .emit("ackFromServer", true, "123", (...args) => {
              expectType<[Error, boolean[], string[]]>(args);
            });
          // Two args + timeout + room + timeout + room
          sio
            .timeout(1)
            .to("1")
            .timeout(1)
            .to("1")
            .emit("ackFromServer", true, "123", (...args) => {
              expectType<[Error, boolean[], string[]]>(args);
            });

          sio.on("connection", (s) => {
            // No args
            s.emit("helloFromServer", "hi", 10);

            // One arg
            s.emit("ackFromServerSingleArg", true, "1", (...args) => {
              expectType<[string]>(args);
            });
            // One arg + timeout
            s.timeout(1).emit(
              "ackFromServerSingleArg",
              true,
              "1",
              (...args) => {
                expectType<[Error, string]>(args);
              }
            );
            // One arg + room
            s.to("1").emit("ackFromServerSingleArg", true, "1", (...args) => {
              expectType<[string[]]>(args);
            });
            // One arg + timeout + room
            s.timeout(1)
              .in("1")
              .emit("ackFromServerSingleArg", true, "1", (...args) => {
                expectType<[Error, string[]]>(args);
              });
            // One arg + timeout + room + timeout + room
            s.timeout(1)
              .to("1")
              .timeout(1)
              .to("1")
              .emit("ackFromServerSingleArg", true, "1", (...args) => {
                expectType<[Error, string[]]>(args);
              });

            // Two args
            s.emit("ackFromServer", true, "1", (...args) => {
              expectType<[boolean, string]>(args);
            });
            // Two args + timeout
            s.timeout(1).emit("ackFromServer", true, "1", (...args) => {
              expectType<[Error, boolean, string]>(args);
            });
            // Two args + room
            s.to("1").emit("ackFromServer", true, "1", (...args) => {
              expectType<[boolean[], string[]]>(args);
            });
            // Two args + timeout + room
            s.timeout(1)
              .in("1")
              .emit("ackFromServer", true, "1", (...args) => {
                expectType<[Error, boolean[], string[]]>(args);
              });
            // Two args + timeout + room + timeout + room
            s.timeout(1)
              .to("1")
              .timeout(1)
              .to("1")
              .emit("ackFromServer", true, "1", (...args) => {
                expectType<[Error, boolean[], string[]]>(args);
              });
            done();
          });
        });
      });

      it("does not accept arguments of wrong types", (done) => {
        const srv = createServer();
        const sio = new Server<ClientToServerEvents, ServerToClientEvents>(srv);
        srv.listen(() => {
          expectError(sio.emit("helloFromClient"));
          expectError(sio.to("room").emit("helloFromClient"));
          expectError(sio.timeout(1000).to("room").emit("helloFromClient"));

          sio.on("connection", (s) => {
            expectError(s.emit("helloFromClient", "hi"));
            expectError(s.emit("helloFromServer", "hi", 10, "10"));
            expectError(s.emit("helloFromServer", "hi", "10"));
            expectError(s.emit("helloFromServer", 0, 0));
            expectError(s.emit("wrong name", 10));
            expectError(s.emit("wrong name"));
            done();
          });
        });
      });
    });

    describe("emitWithAck", () => {
      it("accepts arguments of the correct types", (done) => {
        const srv = createServer();
        const sio = new Server<ClientToServerEvents, ServerToClientEvents>(srv);
        srv.listen(async () => {
          // One arg in callback
          expectType<string[]>(
            await sio.emitWithAck("ackFromServerSingleArg", true, "123")
          );
          // One arg + timeout
          expectType<string[]>(
            await sio
              .timeout(1)
              .emitWithAck("ackFromServerSingleArg", true, "123")
          );
          // One arg + timeout + timeout
          expectType<string[]>(
            await sio
              .timeout(1)
              .timeout(1)
              .emitWithAck("ackFromServerSingleArg", true, "123")
          );
          // One arg + room
          expectType<string[]>(
            await sio.to("1").emitWithAck("ackFromServerSingleArg", true, "123")
          );
          expectType<string[]>(
            await sio.in("1").emitWithAck("ackFromServerSingleArg", true, "123")
          );
          expectType<string[]>(
            await sio
              .except("1")
              .emitWithAck("ackFromServerSingleArg", true, "123")
          );
          // One arg + timeout + room + timeout + room
          expectType<string[]>(
            await sio
              .timeout(1)
              .to("1")
              .timeout(1)
              .to("1")
              .emitWithAck("ackFromServerSingleArg", true, "123")
          );

          // Two args in callback
          expectType<boolean[]>(
            await sio.emitWithAck("ackFromServer", true, "123")
          );
          // Two args + timeout
          expectType<boolean[]>(
            await sio.timeout(1).emitWithAck("ackFromServer", true, "123")
          );
          // Two args + timeout + timeout
          expectType<boolean[]>(
            await sio
              .timeout(1)
              .timeout(1)
              .emitWithAck("ackFromServer", true, "123")
          );
          // Two args + room
          expectType<boolean[]>(
            await sio.to("1").emitWithAck("ackFromServer", true, "123")
          );
          // Two args + timeout + room
          expectType<boolean[]>(
            await sio
              .timeout(1)
              .to("1")
              .emitWithAck("ackFromServer", true, "123")
          );
          // Two args + timeout + room + timeout + room
          expectType<boolean[]>(
            await sio
              .timeout(1)
              .to("1")
              .timeout(1)
              .to("1")
              .emitWithAck("ackFromServer", true, "123")
          );

          sio.on("connection", async (s) => {
            // One arg in callback
            expectType<string>(
              await s.emitWithAck("ackFromServerSingleArg", true, "123")
            );
            // One arg + timeout
            expectType<string>(
              await s
                .timeout(1)
                .emitWithAck("ackFromServerSingleArg", true, "123")
            );
            // One arg + room
            expectType<string[]>(
              await s.to("1").emitWithAck("ackFromServerSingleArg", true, "123")
            );
            // One arg + room + timeout + room
            expectType<string[]>(
              await s
                .to("1")
                .timeout(1)
                .to("1")
                .emitWithAck("ackFromServerSingleArg", true, "123")
            );

            // Two args in callback
            expectType<boolean>(
              await s.emitWithAck("ackFromServer", true, "123")
            );
            // Two args + timeout
            expectType<boolean>(
              await s.timeout(1).emitWithAck("ackFromServer", true, "123")
            );
            // Two args + room
            expectType<boolean[]>(
              await s.to("1").emitWithAck("ackFromServer", true, "123")
            );
            // Two args + room + timeout + room
            expectType<boolean[]>(
              await s
                .to("1")
                .timeout(1)
                .to("1")
                .emitWithAck("ackFromServer", true, "123")
            );

            done();
          });
        });
      });
    });
    describe("namespace", () => {
      describe("emitWithAck", () => {
        it("accepts arguments of the correct types", (done) => {
          const srv = createServer();
          const sio = new Server<ClientToServerEvents, ServerToClientEvents>(
            srv
          );
          const nio = sio.of("/test");
          srv.listen(async () => {
            // One arg in callback
            expectType<string[]>(
              await nio.emitWithAck("ackFromServerSingleArg", true, "123")
            );
            // One arg + timeout
            expectType<string[]>(
              await nio
                .timeout(1)
                .emitWithAck("ackFromServerSingleArg", true, "123")
            );
            // One arg + timeout + timeout
            expectType<string[]>(
              await nio
                .timeout(1)
                .timeout(1)
                .emitWithAck("ackFromServerSingleArg", true, "123")
            );
            // One arg + room
            expectType<string[]>(
              await nio
                .to("1")
                .emitWithAck("ackFromServerSingleArg", true, "123")
            );
            expectType<string[]>(
              await nio
                .in("1")
                .emitWithAck("ackFromServerSingleArg", true, "123")
            );
            expectType<string[]>(
              await nio
                .except("1")
                .emitWithAck("ackFromServerSingleArg", true, "123")
            );

            // Two args in callback
            expectType<boolean[]>(
              await nio.emitWithAck("ackFromServer", true, "123")
            );
            // Two args + timeout
            expectType<boolean[]>(
              await nio.timeout(1).emitWithAck("ackFromServer", true, "123")
            );
            // Two args + timeout + timeout
            expectType<boolean[]>(
              await nio
                .timeout(1)
                .timeout(1)
                .emitWithAck("ackFromServer", true, "123")
            );
            // Two args + room
            expectType<boolean[]>(
              await nio.to("1").emitWithAck("ackFromServer", true, "123")
            );
            // Two args + timeout + room
            expectType<boolean[]>(
              await nio
                .timeout(1)
                .to("1")
                .emitWithAck("ackFromServer", true, "123")
            );

            done();
          });
        });
      });
    });
  });

  describe("listen and emit event maps for the serverSideEmit method", () => {
    interface ClientToServerEvents {
      helloFromClient: (message: string) => void;
    }

    interface ServerToClientEvents {
      helloFromServer: (message: string, x: number) => void;
    }

    interface InterServerEvents {
      helloFromServerToServer: (message: string, x: number) => void;
      ackFromServerToServer: (foo: string, cb: (bar: number) => void) => void;
    }

    describe("on", () => {
      it("infers correct types for listener parameters", () => {
        const srv = createServer();
        const sio = new Server<
          ClientToServerEvents,
          ServerToClientEvents,
          InterServerEvents
        >(srv);

        expectType<
          Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents>
        >(sio);
        srv.listen(async () => {
          sio.serverSideEmit("helloFromServerToServer", "hello", 10);
          sio
            .of("/test")
            .serverSideEmit("helloFromServerToServer", "hello", 10);

          sio.on("helloFromServerToServer", (message, x) => {
            expectType<string>(message);
            expectType<number>(x);
          });
          sio.of("/test").on("helloFromServerToServer", (message, x) => {
            expectType<string>(message);
            expectType<number>(x);
          });

          sio.on("ackFromServerToServer", (...args) => {
            expectType<[string, (bar: number) => void]>(args);
          });

          sio.serverSideEmit("ackFromServerToServer", "foo", (err, bar) => {
            expectType<Error>(err);
            expectType<number[]>(bar);
          });

          const value = await sio.serverSideEmitWithAck(
            "ackFromServerToServer",
            "foo"
          );
          expectType<number[]>(value);

          sio.on("ackFromServerToServer", (foo, cb) => {
            expectType<string>(foo);
            expectType<(bar: number) => void>(cb);
          });
        });
      });
    });
  });

  describe("adapter", () => {
    it("accepts arguments of the correct types", () => {
      const io = new Server({
        adapter: (nsp) => new Adapter(nsp),
      });
      io.adapter(Adapter);

      class MyCustomAdapter extends Adapter {
        constructor(nsp, readonly opts) {
          super(nsp);
        }
      }
      io.adapter((nsp) => new MyCustomAdapter(nsp, { test: "123" }));
    });

    it("does not accept arguments of wrong types", () => {
      const io = new Server();
      expectError(io.adapter((nsp) => "nope"));
    });
  });
});
