"use strict";
import { createServer } from "http";
import { Adapter } from "socket.io-adapter";
import { expectType } from "tsd";
import {
  BroadcastOperator,
  Server,
  Socket,
  type DisconnectReason,
} from "../lib/index";
import type { DefaultEventsMap, EventsMap } from "../lib/typed-events";

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
          sio.emit("random", 1, "2", [3]);
          sio.emit("no parameters");
          sio.on("connection", (s) => {
            s.emit("random", 1, "2", [3]);
            s.emit("no parameters");
          });
        });
      });
    });
    describe("send", () => {
      it("accepts any parameters", () => {
        const srv = createServer();
        const sio = new Server(srv);
        const nio = sio.of("/test");
        sio.send(1, "2", [3]);
        sio.send();
        nio.send(1, "2", [3]);
        nio.send();
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
        // @ts-expect-error - shouldn't accept arguments of the wrong types
        sio.on("random", (a, b, c) => {});
        srv.listen(() => {
          // @ts-expect-error - shouldn't accept arguments of the wrong types
          sio.on("wrong name", (s) => {});
          sio.on("connection", (s) => {
            s.on("random", (a, b, c) => {});
            // @ts-expect-error - shouldn't accept arguments of the wrong types
            s.on("random");
            // @ts-expect-error - shouldn't accept arguments of the wrong types
            s.on("random", (a, b, c, d) => {});
            // @ts-expect-error - shouldn't accept arguments of the wrong types
            s.on(2, 3);
          });
        });
      });
    });
  });
  type ToEmit<Map extends EventsMap, Ev extends keyof Map = keyof Map> = (
    ev: Ev,
    ...args: Parameters<Map[Ev]>
  ) => boolean;
  type ToEmitWithAck<
    Map extends EventsMap,
    Ev extends keyof Map = keyof Map
  > = (ev: Ev, ...args: Parameters<Map[Ev]>) => ReturnType<Map[Ev]>;
  interface ClientToServerEvents {
    noArgs: () => void;
    helloFromClient: (message: string) => void;
    ackFromClient: (
      a: string,
      b: number,
      ack: (c: string, d: number) => void
    ) => void;
  }

  interface ServerToClientEvents {
    noArgs: () => void;
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
    onlyCallback: (a: () => void) => void;
  }
  // While these could be generated using the types from typed-events,
  // it's likely better to just write them out, so that both the types and this are tested properly
  interface ServerToClientEventsNoAck {
    noArgs: () => void;
    helloFromServer: (message: string, x: number) => void;
    ackFromServer: never;
    ackFromServerSingleArg: never;
    onlyCallback: never;
  }
  interface ServerToClientEventsWithError {
    noArgs: () => void;
    helloFromServer: (message: string, x: number) => void;
    ackFromServer: (
      a: boolean,
      b: string,
      ack: (err: Error, c: boolean, d: string) => void
    ) => void;
    ackFromServerSingleArg: (
      a: boolean,
      b: string,
      ack: (err: Error, c: string) => void
    ) => void;
    onlyCallback: (a: (err: Error) => void) => void;
  }

  interface ServerToClientEventsWithMultiple {
    noArgs: () => void;
    helloFromServer: (message: string, x: number) => void;
    ackFromServer: (a: boolean, b: string, ack: (c: boolean[]) => void) => void;
    ackFromServerSingleArg: (
      a: boolean,
      b: string,
      ack: (c: string[]) => void
    ) => void;
    onlyCallback: (a: () => void) => void;
  }
  interface ServerToClientEventsWithMultipleAndError {
    noArgs: () => void;
    helloFromServer: (message: string, x: number) => void;
    ackFromServer: (
      a: boolean,
      b: string,
      ack: (err: Error, c: boolean[]) => void
    ) => void;
    ackFromServerSingleArg: (
      a: boolean,
      b: string,
      ack: (err: Error, c: string[]) => void
    ) => void;
    onlyCallback: (a: (err: Error) => void) => void;
  }
  interface ServerToClientEventsWithMultipleWithAck {
    ackFromServer: (a: boolean, b: string) => Promise<boolean[]>;
    ackFromServerSingleArg: (a: boolean, b: string) => Promise<string[]>;
    // This should technically be `undefined[]`, but this doesn't work currently *only* with emitWithAck
    // you can use an empty callback with emit, but not emitWithAck
    onlyCallback: () => Promise<undefined>;
  }
  interface ServerToClientEventsWithAck {
    ackFromServer: (a: boolean, b: string) => Promise<boolean>;
    ackFromServerSingleArg: (a: boolean, b: string) => Promise<string>;
    // This doesn't work currently *only* with emitWithAck
    // you can use an empty callback with emit, but not emitWithAck
    onlyCallback: () => Promise<undefined>;
  }
  describe("Emitting Types", () => {
    describe("send", () => {
      it("prevents arguments if EmitEvents doesn't have message", () => {
        const sio = new Server<ClientToServerEvents, ServerToClientEvents>();
        const nio = sio.of("/test");
        // @ts-expect-error - ServerToClientEvents doesn't have a message event
        sio.send(1, "2", [3]);
        // @ts-expect-error - ServerToClientEvents doesn't have a message event
        nio.send(1, "2", [3]);
        // This correctly becomes an error in TS 5.3.2, so when updating typescript, this should expect-error
        sio.send();
        nio.send();
      });
      it("has the correct types", () => {
        const sio = new Server<
          {},
          { message: (a: number, b: string, c: number[]) => void }
        >();
        const nio = sio.of("/test");
        sio.send(1, "2", [3]);
        nio.send(1, "2", [3]);
        // @ts-expect-error - message requires arguments
        sio.send();
        // @ts-expect-error - message requires arguments
        nio.send();
        // @ts-expect-error - message requires the correct arguments
        sio.send(1, 2, [3]);
        // @ts-expect-error - message requires the correct arguments
        nio.send(1, 2, [3]);
      });
    });
    describe("Broadcast Operator", () => {
      it("works untyped", () => {
        const untyped = new Server();
        untyped.emit("random", 1, 2, Function, Boolean);
        untyped.of("/").emit("random2", 2, "string", Server);
        expectType<Promise<any>>(untyped.to("1").emitWithAck("random", "test"));
        expectType<(ev: string, ...args: any[]) => Promise<any>>(
          untyped.to("1").emitWithAck<string>
        );
      });
      it("has the correct types", () => {
        // Ensuring that all paths to BroadcastOperator have the correct types
        // means that we only need one set of tests for emitting once the
        // socket/namespace/server becomes a broadcast emitter
        const sio = new Server<ClientToServerEvents, ServerToClientEvents>();
        const nio = sio.of("/");
        for (const emitter of [sio, nio]) {
          expectType<BroadcastOperator<ServerToClientEventsWithMultiple, any>>(
            emitter.to("1")
          );
          expectType<BroadcastOperator<ServerToClientEventsWithMultiple, any>>(
            emitter.in("1")
          );
          expectType<BroadcastOperator<ServerToClientEventsWithMultiple, any>>(
            emitter.except("1")
          );
          expectType<BroadcastOperator<ServerToClientEventsWithMultiple, any>>(
            emitter.except("1")
          );
          expectType<BroadcastOperator<ServerToClientEventsWithMultiple, any>>(
            emitter.compress(true)
          );
          expectType<BroadcastOperator<ServerToClientEventsWithMultiple, any>>(
            emitter.volatile
          );
          expectType<BroadcastOperator<ServerToClientEventsWithMultiple, any>>(
            emitter.local
          );
          expectType<
            BroadcastOperator<ServerToClientEventsWithMultipleAndError, any>
          >(emitter.timeout(0));
          expectType<
            BroadcastOperator<ServerToClientEventsWithMultipleAndError, any>
          >(emitter.timeout(0).timeout(0));
        }
        sio.on("connection", (s) => {
          expectType<
            Socket<
              ClientToServerEvents,
              ServerToClientEventsWithError,
              DefaultEventsMap,
              any
            >
          >(s.timeout(0));
          expectType<
            BroadcastOperator<ServerToClientEventsWithMultipleAndError, any>
          >(s.timeout(0).broadcast);
          // ensure that turning socket to a broadcast works correctly
          expectType<BroadcastOperator<ServerToClientEventsWithMultiple, any>>(
            s.broadcast
          );
          expectType<BroadcastOperator<ServerToClientEventsWithMultiple, any>>(
            s.in("1")
          );
          expectType<BroadcastOperator<ServerToClientEventsWithMultiple, any>>(
            s.except("1")
          );
          expectType<BroadcastOperator<ServerToClientEventsWithMultiple, any>>(
            s.to("1")
          );
          // Ensure that adding a timeout to a broadcast works after the fact
          expectType<
            BroadcastOperator<ServerToClientEventsWithMultipleAndError, any>
          >(s.broadcast.timeout(0));
          // Ensure that adding a timeout to a broadcast works after the fact
          expectType<
            BroadcastOperator<ServerToClientEventsWithMultipleAndError, any>
          >(s.broadcast.timeout(0).timeout(0));
        });
      });
      it("has the correct types for `emit`", () => {
        const sio = new Server<ClientToServerEvents, ServerToClientEvents>();
        expectType<ToEmit<ServerToClientEventsWithMultipleAndError, "noArgs">>(
          sio.timeout(0).emit<"noArgs">
        );
        expectType<
          ToEmit<ServerToClientEventsWithMultipleAndError, "helloFromServer">
        >(sio.timeout(0).emit<"helloFromServer">);
        expectType<
          ToEmit<
            ServerToClientEventsWithMultipleAndError,
            "ackFromServerSingleArg"
          >
        >(sio.timeout(0).emit<"ackFromServerSingleArg">);
        expectType<
          ToEmit<ServerToClientEventsWithMultipleAndError, "ackFromServer">
        >(sio.timeout(0).emit<"ackFromServer">);
        expectType<
          ToEmit<ServerToClientEventsWithMultipleAndError, "onlyCallback">
        >(sio.timeout(0).emit<"onlyCallback">);
      });
      it("has the correct types for `emitWithAck`", () => {
        const sio = new Server<ClientToServerEvents, ServerToClientEvents>();
        const sansTimeout = sio.in("1");
        // Without timeout, `emitWithAck` shouldn't accept any events
        expectType<never>(
          undefined as Parameters<typeof sansTimeout["emitWithAck"]>[0]
        );
        // @ts-expect-error - "noArgs" doesn't have a callback and is thus excluded
        sio.timeout(0).emitWithAck("noArgs");
        // @ts-expect-error - "helloFromServer" doesn't have a callback and is thus excluded
        sio.timeout(0).emitWithAck("helloFromServer");
        // @ts-expect-error - "onlyCallback" doesn't have a callback and is thus excluded
        sio.timeout(0).emitWithAck("onlyCallback");
        expectType<
          ToEmitWithAck<
            ServerToClientEventsWithMultipleWithAck,
            "ackFromServerSingleArg"
          >
        >(sio.timeout(0).emitWithAck<"ackFromServerSingleArg">);
        expectType<
          ToEmitWithAck<
            ServerToClientEventsWithMultipleWithAck,
            "ackFromServer"
          >
        >(sio.timeout(0).emitWithAck<"ackFromServer">);
      });
    });
    describe("emit", () => {
      it("Infers correct types", () => {
        const sio = new Server<ClientToServerEvents, ServerToClientEvents>();
        const nio = sio.of("/test");
        expectType<ToEmit<ServerToClientEventsNoAck, "noArgs">>(
          sio.emit<"noArgs">
        );
        expectType<ToEmit<ServerToClientEventsNoAck, "noArgs">>(
          nio.emit<"noArgs">
        );
        expectType<ToEmit<ServerToClientEventsNoAck, "helloFromServer">>(
          // These errors will dissapear once the TS version is updated from 4.7.4
          // the TSD instance is using a newer version of TS than the workspace version
          // to enable the ability to compare against `any`
          sio.emit<"helloFromServer">
        );
        expectType<ToEmit<ServerToClientEventsNoAck, "helloFromServer">>(
          nio.emit<"helloFromServer">
        );
        sio.on("connection", (s) => {
          expectType<ToEmit<ServerToClientEvents, "noArgs">>(s.emit<"noArgs">);
          expectType<ToEmit<ServerToClientEvents, "helloFromServer">>(
            s.emit<"helloFromServer">
          );
          expectType<ToEmit<ServerToClientEvents, "ackFromServerSingleArg">>(
            s.emit<"ackFromServerSingleArg">
          );
          expectType<ToEmit<ServerToClientEvents, "ackFromServer">>(
            s.emit<"ackFromServer">
          );
          expectType<ToEmit<ServerToClientEvents, "onlyCallback">>(
            s.emit<"onlyCallback">
          );
        });
      });
      it("does not allow events with acks", () => {
        const sio = new Server<ClientToServerEvents, ServerToClientEvents>();
        const nio = sio.of("/test");
        // @ts-expect-error - "ackFromServerSingleArg" has a callback and is thus excluded
        sio.emit<"ackFromServerSingleArg">;
        // @ts-expect-error - "ackFromServer" has a callback and is thus excluded
        sio.emit<"ackFromServer">;
        // @ts-expect-error - "onlyCallback" has a callback and is thus excluded
        sio.emit<"onlyCallback">;
        // @ts-expect-error - "ackFromServerSingleArg" has a callback and is thus excluded
        nio.emit<"ackFromServerSingleArg">;
        // @ts-expect-error - "ackFromServer" has a callback and is thus excluded
        nio.emit<"ackFromServer">;
        // @ts-expect-error - "onlyCallback" has a callback and is thus excluded
        nio.emit<"onlyCallback">;
      });
    });
    describe("emitWithAck", () => {
      it("Infers correct types", () => {
        const sio = new Server<ClientToServerEvents, ServerToClientEvents>();
        sio.on("connection", (s) => {
          // @ts-expect-error - "noArgs" doesn't have a callback and is thus excluded
          s.emitWithAck("noArgs");
          // @ts-expect-error - "helloFromServer" doesn't have a callback and is thus excluded
          s.emitWithAck("helloFromServer");
          // @ts-expect-error - "onlyCallback" doesn't have a callback and is thus excluded
          s.emitWithAck("onlyCallback");
          // @ts-expect-error - "onlyCallback" doesn't have a callback and is thus excluded
          s.timeout(0).emitWithAck("onlyCallback");
          expectType<
            ToEmitWithAck<ServerToClientEventsWithAck, "ackFromServerSingleArg">
          >(s.emitWithAck<"ackFromServerSingleArg">);
          expectType<
            ToEmitWithAck<ServerToClientEventsWithAck, "ackFromServer">
          >(s.emitWithAck<"ackFromServer">);

          expectType<
            ToEmitWithAck<ServerToClientEventsWithAck, "ackFromServerSingleArg">
          >(s.timeout(0).emitWithAck<"ackFromServerSingleArg">);
          expectType<
            ToEmitWithAck<ServerToClientEventsWithAck, "ackFromServer">
          >(s.timeout(0).emitWithAck<"ackFromServer">);
        });
      });
    });
  });
  describe("listen and emit event maps", () => {
    describe("on", () => {
      it("infers correct types for listener parameters", (done) => {
        const srv = createServer();
        const sio = new Server<ClientToServerEvents, ServerToClientEvents>(srv);
        expectType<Server<ClientToServerEvents, ServerToClientEvents>>(sio);
        srv.listen(() => {
          sio.on("connection", (s) => {
            expectType<Socket<ClientToServerEvents, ServerToClientEvents>>(s);
            s.on("noArgs", (...args) => {
              expectType<[]>(args);
              done();
            });
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
            // @ts-expect-error - shouldn't accept emit events
            s.on("noArgs", (message, number) => {
              done();
            });
            // @ts-expect-error - shouldn't accept emit events
            s.on("helloFromServer", (message, number) => {
              done();
            });
          });
        });
      });
    });
  });

  describe("listen and emit event maps for the serverSideEmit method", () => {
    interface ClientToServerEvents {
      noArgs: () => void;
      helloFromClient: (message: string) => void;
    }

    interface ServerToClientEvents {
      noArgs: () => void;
      helloFromServer: (message: string, x: number) => void;
    }

    interface InterServerEvents {
      noArgs: () => void;
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
          sio.serverSideEmit("noArgs");
          sio.serverSideEmit("helloFromServerToServer", "hello", 10);
          sio
            .of("/test")
            .serverSideEmit("helloFromServerToServer", "hello", 10);

          sio.on("noArgs", (...args) => {
            expectType<[]>(args);
          });
          sio.on("helloFromServerToServer", (message, x) => {
            expectType<string>(message);
            expectType<number>(x);
          });
          sio.of("/test").on("noArgs", (...args) => {
            expectType<[]>(args);
          });
          sio.of("/test").on("helloFromServerToServer", (message, x) => {
            expectType<string>(message);
            expectType<number>(x);
          });

          //@ts-expect-error - "helloFromServerToServer" does not have a callback
          sio.serverSideEmitWithAck("noArgs");
          //@ts-expect-error - "helloFromServerToServer" does not have a callback
          sio.serverSideEmitWithAck("helloFromServerToServer", "hello");

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
      // @ts-expect-error - shouldn't accept arguments of the wrong types
      io.adapter((nsp) => "nope");
    });
  });
});
