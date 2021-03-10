import { io, Socket } from "..";
import type { DefaultEventsMap } from "../lib/typed-events";
import { expectError, expectType } from "tsd";

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
    });

    describe("emit", () => {
      it("accepts any parameters", () => {
        const socket = io();

        socket.emit("random", 1, "2", [3]);
        socket.emit("no parameters");
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
  });
});
