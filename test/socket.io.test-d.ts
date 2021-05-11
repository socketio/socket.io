"use strict";
import { Namespace, Server, Socket } from "..";
import type { DefaultEventsMap } from "../lib/typed-events";
import { createServer } from "http";
import { expectError, expectType } from "tsd";
import { Adapter } from "socket.io-adapter";

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
              expectType<string>(reason);
            });
            s.on("disconnecting", (reason) => {
              expectType<string>(reason);
            });
          });
          sio.on("connect", (s) => {
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
            // TODO(#3833): Make this expect `Socket<DefaultEventsMap, DefaultEventsMap>`
            expectType<any>(socket);

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
    }

    interface ServerToClientEvents {
      helloFromServer: (message: string, x: number) => void;
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
          sio.on("connection", (s) => {
            s.emit("helloFromServer", "hi", 10);
            done();
          });
        });
      });

      it("does not accept arguments of wrong types", (done) => {
        const srv = createServer();
        const sio = new Server<ClientToServerEvents, ServerToClientEvents>(srv);
        srv.listen(() => {
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
  });

  describe("listen and emit event maps", () => {
    interface ClientToServerEvents {
      helloFromClient: (message: string) => void;
    }

    interface ServerToClientEvents {
      helloFromServer: (message: string, x: number) => void;
    }

    interface InterServerEvents {
      helloFromServerToServer: (message: string, x: number) => void;
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
        srv.listen(() => {
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
