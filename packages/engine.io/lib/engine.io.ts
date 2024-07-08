import { createServer } from "http";
import { Server, AttachOptions, ServerOptions } from "./server";
import transports from "./transports/index";
import * as parser from "engine.io-parser";

export { Server, transports, listen, attach, parser };
export type { AttachOptions, ServerOptions, BaseServer } from "./server";
export { uServer } from "./userver";
export { Socket } from "./socket";
export { Transport } from "./transport";
export const protocol = parser.protocol;

/**
 * Creates an http.Server exclusively used for WS upgrades.
 *
 * @param {Number} port
 * @param {Function} callback
 * @param {Object} options
 * @return {Server} websocket.io server
 */

function listen(port, options: AttachOptions & ServerOptions, fn) {
  if ("function" === typeof options) {
    fn = options;
    options = {};
  }

  const server = createServer(function (req, res) {
    res.writeHead(501);
    res.end("Not Implemented");
  });

  // create engine server
  const engine = attach(server, options);
  engine.httpServer = server;

  server.listen(port, fn);

  return engine;
}

/**
 * Captures upgrade requests for a http.Server.
 *
 * @param {http.Server} server
 * @param {Object} options
 * @return {Server} engine server
 */

function attach(server, options: AttachOptions & ServerOptions) {
  const engine = new Server(options);
  engine.attach(server, options);
  return engine;
}
