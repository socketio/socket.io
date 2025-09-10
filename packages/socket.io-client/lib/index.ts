import { url } from "./url.js";
import { Manager, ManagerOptions } from "./manager.js";
import { DisconnectDescription, Socket, SocketOptions } from "./socket.js";
import debugModule from "debug"; // debug()

const debug = debugModule("socket.io-client"); // debug()

/**
 * Managers cache.
 */
const cache: Record<string, Manager> = {};

/**
 * Looks up an existing `Manager` for multiplexing.
 * If the user summons:
 *
 *   `io('http://localhost/a');`
 *   `io('http://localhost/b');`
 *
 * We reuse the existing instance based on same scheme/port/host,
 * and we initialize sockets for each namespace.
 *
 * @public
 */
function lookup(opts?: Partial<ManagerOptions & SocketOptions>): Socket;
function lookup(
  uri?: string,
  opts?: Partial<ManagerOptions & SocketOptions>,
): Socket;
function lookup(
  uri?: string | Partial<ManagerOptions & SocketOptions>,
  opts?: Partial<ManagerOptions & SocketOptions>,
): Socket {
  if (typeof uri === "object") {
    opts = uri;
    uri = undefined;
  }

  opts = opts || {};

  const parsed = url(uri as string, opts.path || "/socket.io");
  const source = parsed.source;
  const id = parsed.id;
  const path = parsed.path;
  const sameNamespace = cache[id] && path in cache[id]["nsps"];
  const newConnection =
    opts.forceNew ||
    opts["force new connection"] ||
    false === opts.multiplex ||
    sameNamespace;

  let io: Manager;

  if (newConnection) {
    debug("ignoring socket cache for %s", source);
    io = new Manager(source, opts);
  } else {
    if (!cache[id]) {
      debug("new io instance for %s", source);
      cache[id] = new Manager(source, opts);
    }
    io = cache[id];
  }
  if (parsed.query && !opts.query) {
    opts.query = parsed.queryKey;
  }
  return io.socket(parsed.path, opts);
}

// so that "lookup" can be used both as a function (e.g. `io(...)`) and as a
// namespace (e.g. `io.connect(...)`), for backward compatibility
Object.assign(lookup, {
  Manager,
  Socket,
  io: lookup,
  connect: lookup,
});

/**
 * Protocol version.
 *
 * @public
 */

export { protocol } from "socket.io-parser";

/**
 * Expose constructors for standalone build.
 *
 * @public
 */

export {
  DisconnectDescription,
  Manager,
  ManagerOptions,
  Socket,
  SocketOptions,
  lookup as io,
  lookup as connect,
  lookup as default,
};

export {
  Fetch,
  NodeXHR,
  XHR,
  NodeWebSocket,
  WebSocket,
  WebTransport,
} from "engine.io-client";
