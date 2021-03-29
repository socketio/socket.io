import { url } from "./url";
import { Manager, ManagerOptions } from "./manager";
import { Socket, SocketOptions } from "./socket";

const debug = require("debug")("socket.io-client");

/**
 * Module exports.
 */

module.exports = exports = lookup;

/**
 * Managers cache.
 */
const cache: Record<string, Manager> = (exports.managers = {});

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
  uri: string,
  opts?: Partial<ManagerOptions & SocketOptions>
): Socket;
function lookup(
  uri: string | Partial<ManagerOptions & SocketOptions>,
  opts?: Partial<ManagerOptions & SocketOptions>
): Socket;
function lookup(
  uri: string | Partial<ManagerOptions & SocketOptions>,
  opts?: Partial<ManagerOptions & SocketOptions>
): Socket {
  if (typeof uri === "object") {
    opts = uri;
    uri = undefined;
  }

  opts = opts || {};

  const parsed = url(uri as string, opts.path);
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

/**
 * Protocol version.
 *
 * @public
 */

export { protocol } from "socket.io-parser";

/**
 * `connect`.
 *
 * @param {String} uri
 * @public
 */

exports.connect = lookup;

/**
 * Expose constructors for standalone build.
 *
 * @public
 */

export { Manager, ManagerOptions } from "./manager";
export { lookup as io, Socket, SocketOptions };
export default lookup;
