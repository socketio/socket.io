import type { Server } from "../..";
import {
  io as ioc,
  ManagerOptions,
  Socket as ClientSocket,
  SocketOptions,
} from "socket.io-client";

const expect = require("expect.js");
const i = expect.stringify;

// add support for Set/Map
const contain = expect.Assertion.prototype.contain;
expect.Assertion.prototype.contain = function (...args) {
  if (typeof this.obj === "object") {
    args.forEach((obj) => {
      this.assert(
        this.obj.has(obj),
        function () {
          return "expected " + i(this.obj) + " to contain " + i(obj);
        },
        function () {
          return "expected " + i(this.obj) + " to not contain " + i(obj);
        }
      );
    });
    return this;
  }
  return contain.apply(this, args);
};

export function createClient(
  io: Server,
  nsp: string,
  opts?: ManagerOptions & SocketOptions
): ClientSocket {
  // @ts-ignore
  const port = io.httpServer.address().port;
  return ioc(`http://localhost:${port}${nsp}`, opts);
}

export function success(done: Function, io: Server, client: ClientSocket) {
  io.close();
  client.disconnect();
  done();
}
