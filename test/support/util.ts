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
  if (this.obj instanceof Set || this.obj instanceof Map) {
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
  nsp: string = "/",
  opts?: Partial<ManagerOptions & SocketOptions>
): ClientSocket {
  // @ts-ignore
  const port = io.httpServer.address().port;
  return ioc(`http://localhost:${port}${nsp}`, opts);
}

export function success(
  done: Function,
  io: Server,
  ...clients: ClientSocket[]
) {
  io.close();
  clients.forEach((client) => client.disconnect());
  done();
}

export function successFn(
  done: () => void,
  sio: Server,
  ...clientSockets: ClientSocket[]
) {
  return () => success(done, sio, ...clientSockets);
}

export function getPort(io: Server): number {
  // @ts-ignore
  return io.httpServer.address().port;
}

export function createPartialDone(count: number, done: (err?: Error) => void) {
  let i = 0;
  return () => {
    if (++i === count) {
      done();
    } else if (i > count) {
      done(new Error(`partialDone() called too many times: ${i} > ${count}`));
    }
  };
}

export function waitFor(emitter, event) {
  return new Promise((resolve) => {
    emitter.once(event, resolve);
  });
}
