import { io, Socket } from "..";
import type { DefaultEventsMap } from "@socket.io/component-emitter";
import { expectError, expectType } from "tsd";
import { createServer } from "http";

// This file is run by tsd, not mocha.

describe("typed events", () => {
  describe("no event map", () => {
    describe("on", () => {
      it("infers correct types for listener parameters of reserved events", () => {
        const socket = io();
        expectType<Socket<DefaultEventsMap, DefaultEventsMap>>(socket);

        expectError(socket.on("connect", (arg) => {}));

        socket.on("connect_error", (err) => {
          expectType<Error>(err);
        });

        socket.on("disconnect", (reason) => {
          expectType<Socket.DisconnectReason>(reason);
        });
      });

      it("infers 'any' for listener parameters of other events", () => {
        const socket = io();

        socket.on("random", (a, b, c) => {
          expectType<any>(a);
          expectType<any>(b);
          expectType<any>(c);
        });
      });

      it("infers 'any' for listener parameters of other events using enums", () => {
        const socket = io();

        enum Events {
          TEST = "test",
        }

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

    describe("emit", () => {
      it("accepts any parameters", async () => {
        const socket = io();

        socket.emit("random", 1, "2", [3]);
        socket.emit("no parameters");

        socket.emit("ackFromClient", "1", 2, (c, d) => {
          expectType<any>(c);
          expectType<any>(d);
        });

        socket.timeout(1000).emit("ackFromClient", "1", 2, (err, c, d) => {
          expectType<any>(err);
          expectType<any>(c);
          expectType<any>(d);
        });
      });
    });

    describe("emitWithAck", () => {
      it("accepts any parameters", async () => {
        const socket = io();

        const value = await socket.emitWithAck(
          "ackFromClientSingleArg",
          "1",
          2
        );
        expectType<any>(value);

        const value2 = await socket
          .timeout(1000)
          .emitWithAck("ackFromClientSingleArg", "3", 4);
        expectType<any>(value2);
      });
    });
  });

  describe("single event map", () => {
    interface BidirectionalEvents {
      random: (a: number, b: string, c: number[]) => void;
    }

    describe("on", () => {
      it("infers correct types for listener parameters", () => {
        const socket: Socket<BidirectionalEvents> = io();

        expectType<Socket<BidirectionalEvents, BidirectionalEvents>>(socket);

        socket.on("random", (a, b, c) => {
          expectType<number>(a);
          expectType<string>(b);
          expectType<number[]>(c);
        });
      });

      it("does not accept arguments of wrong types", () => {
        const socket: Socket<BidirectionalEvents> = io();

        expectType<Socket<BidirectionalEvents, BidirectionalEvents>>(socket);

        expectError(socket.on("random"));
        expectError(socket.on("random", (a, b, c, d) => {}));
        expectError(socket.on(2, 3));
      });
    });

    describe("emit", () => {
      it("accepts arguments of the correct types", () => {
        const socket: Socket<BidirectionalEvents> = io();

        socket.emit("random", 1, "2", [3]);
      });

      it("does not accept arguments of the wrong types", () => {
        const socket: Socket<BidirectionalEvents> = io();

        expectError(socket.emit("random"));
        expectError(socket.emit("random", (a, b, c) => {}));
      });
    });
  });

  describe("listen and emit event maps", () => {
    interface ClientToServerEvents {
      helloFromClient: (message: string) => void;
      ackFromClient: (
        a: string,
        b: number,
        ack: (c: string, d: boolean) => void
      ) => void;
      ackFromClientSingleArg: (
        a: string,
        b: number,
        ack: (c: string) => void
      ) => void;
      ackFromClientNoArg: (ack: () => void) => void;
    }

    interface ServerToClientEvents {
      helloFromServer: (message: string, x: number) => void;
    }

    describe("on", () => {
      it("infers correct types for listener parameters", () => {
        const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io();

        expectType<Socket<ServerToClientEvents, ClientToServerEvents>>(socket);

        socket.on("helloFromServer", (message) => {
          expectType<string>(message);
        });
      });

      it("does not accept emit events", () => {
        const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io();

        expectType<Socket<ServerToClientEvents, ClientToServerEvents>>(socket);

        expectError(socket.on("helloFromClient", (message) => {}));
      });
    });

    describe("emit", () => {
      it("accepts arguments of the correct types", () => {
        const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io();

        socket.emit("helloFromClient", "hi");

        socket.emit("ackFromClient", "1", 2, (c, d) => {
          expectType<string>(c);
          expectType<boolean>(d);
        });

        socket.timeout(1000).emit("ackFromClient", "1", 2, (err, c, d) => {
          expectType<Error>(err);
          expectType<string>(c);
          expectType<boolean>(d);
        });

        socket.emit("ackFromClientNoArg", () => {});

        socket.timeout(1000).emit("ackFromClientNoArg", (err) => {
          expectType<Error>(err);
        });
      });

      it("does not accept arguments of wrong types", () => {
        const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io();

        expectError(socket.emit("helloFromClient"));
        expectError(socket.emit("helloFromClient", 10));
        expectError(socket.emit("helloFromClient", "hi", 10));
        expectError(socket.emit("helloFromServer", "hi", 10));
        expectError(socket.emit("wrong name", 10));
        expectError(socket.emit("wrong name"));
      });
    });

    describe("emitWithAck", () => {
      it("accepts arguments of the correct types", async () => {
        const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io();

        const value = await socket.emitWithAck(
          "ackFromClientSingleArg",
          "1",
          2
        );
        expectType<string>(value);

        const value2 = await socket
          .timeout(1000)
          .emitWithAck("ackFromClientSingleArg", "3", 4);
        expectType<string>(value2);
      });
    });
  });
});
