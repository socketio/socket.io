import * as qs from "querystring";
import { parse } from "url";
import * as base64id from "base64id";
import transports from "./transports";
import { EventEmitter } from "events";
import { Socket } from "./socket";
import debugModule from "debug";
import { serialize } from "cookie";
import {
  Server as DEFAULT_WS_ENGINE,
  type Server as WsServer,
  type PerMessageDeflateOptions,
  type WebSocket as WsWebSocket,
} from "ws";
import type {
  IncomingMessage,
  Server as HttpServer,
  ServerResponse,
} from "http";
import type { CorsOptions, CorsOptionsDelegate } from "cors";
import type { Duplex } from "stream";
import { WebTransport } from "./transports/webtransport";
import { createPacketDecoderStream } from "engine.io-parser";
import type { EngineRequest, Transport } from "./transport";
import type { CookieSerializeOptions } from "./contrib/types.cookie";

const debug = debugModule("engine");

const kResponseHeaders = Symbol("responseHeaders");

type TransportName = "polling" | "websocket" | "webtransport";

export type ErrorCallback = (
  errorCode?: (typeof Server.errors)[keyof typeof Server.errors],
  errorContext?: Record<string, unknown> & { name?: string; message?: string },
) => void;

export interface AttachOptions {
  /**
   * name of the path to capture
   * @default "/engine.io"
   */
  path?: string;
  /**
   * destroy unhandled upgrade requests
   * @default true
   */
  destroyUpgrade?: boolean;
  /**
   * milliseconds after which unhandled requests are ended
   * @default 1000
   */
  destroyUpgradeTimeout?: number;

  /**
   * Whether we should add a trailing slash to the request path.
   * @default true
   */
  addTrailingSlash?: boolean;
}

export interface ServerOptions {
  /**
   * how many ms without a pong packet to consider the connection closed
   * @default 20000
   */
  pingTimeout?: number;
  /**
   * how many ms before sending a new ping packet
   * @default 25000
   */
  pingInterval?: number;
  /**
   * how many ms before an uncompleted transport upgrade is cancelled
   * @default 10000
   */
  upgradeTimeout?: number;
  /**
   * how many bytes or characters a message can be, before closing the session (to avoid DoS).
   * @default 1e5 (100 KB)
   */
  maxHttpBufferSize?: number;
  /**
   * A function that receives a given handshake or upgrade request as its first parameter,
   * and can decide whether to continue or not. The second argument is a function that needs
   * to be called with the decided information: fn(err, success), where success is a boolean
   * value where false means that the request is rejected, and err is an error code.
   */
  allowRequest?: (
    req: IncomingMessage,
    fn: (err: string | null | undefined, success: boolean) => void,
  ) => void;
  /**
   * The low-level transports that are enabled. WebTransport is disabled by default and must be manually enabled:
   *
   * @example
   * new Server({
   *   transports: ["polling", "websocket", "webtransport"]
   * });
   *
   * @default ["polling", "websocket"]
   */
  transports?: TransportName[];
  /**
   * whether to allow transport upgrades
   * @default true
   */
  allowUpgrades?: boolean;
  /**
   * parameters of the WebSocket permessage-deflate extension (see ws module api docs). Set to false to disable.
   * @default false
   */
  perMessageDeflate?: boolean | PerMessageDeflateOptions;
  /**
   * parameters of the http compression for the polling transports (see zlib api docs). Set to false to disable.
   * @default true
   */
  httpCompression?: boolean | object;
  /**
   * what WebSocket server implementation to use. Specified module must
   * conform to the ws interface (see ws module api docs).
   * An alternative c++ addon is also available by installing eiows module.
   *
   * @default `require("ws").Server`
   */
  wsEngine?: any;
  /**
   * an optional packet which will be concatenated to the handshake packet emitted by Engine.IO.
   */
  initialPacket?: any;
  /**
   * configuration of the cookie that contains the client sid to send as part of handshake response headers. This cookie
   * might be used for sticky-session. Defaults to not sending any cookie.
   * @default false
   */
  cookie?: (CookieSerializeOptions & { name: string }) | boolean;
  /**
   * the options that will be forwarded to the cors module
   */
  cors?: CorsOptions | CorsOptionsDelegate;
  /**
   * whether to enable compatibility with Socket.IO v2 clients
   * @default false
   */
  allowEIO3?: boolean;
}

/**
 * An Express-compatible middleware.
 *
 * Middleware functions are functions that have access to the request object (req), the response object (res), and the
 * next middleware function in the application’s request-response cycle.
 *
 * @see https://expressjs.com/en/guide/using-middleware.html
 */
type Middleware = (
  req: IncomingMessage,
  res: ServerResponse,
  next: (err?: any) => void,
) => void;

function parseSessionId(data: string): string | undefined {
  try {
    const parsed = JSON.parse(data);
    if (typeof parsed.sid === "string") {
      return parsed.sid;
    }
  } catch (e) {}
}

export abstract class BaseServer extends EventEmitter {
  public opts: ServerOptions;

  // TODO for the next major release: use a Map instead
  protected clients: Record<string, Socket>;
  public clientsCount: number;
  protected middlewares: Middleware[] = [];

  /**
   * Server constructor.
   *
   * @param {Object} opts - options
   */
  constructor(opts: ServerOptions = {}) {
    super();

    this.clients = {};
    this.clientsCount = 0;

    this.opts = Object.assign(
      {
        wsEngine: DEFAULT_WS_ENGINE,
        pingTimeout: 20000,
        pingInterval: 25000,
        upgradeTimeout: 10000,
        maxHttpBufferSize: 1e6,
        transports: ["polling", "websocket"], // WebTransport is disabled by default
        allowUpgrades: true,
        httpCompression: {
          threshold: 1024,
        },
        cors: false,
        allowEIO3: false,
      },
      opts,
    );

    if (opts.cookie) {
      this.opts.cookie = Object.assign(
        {
          name: "io",
          path: "/",
          // @ts-ignore
          httpOnly: opts.cookie.path !== false,
          sameSite: "lax",
        },
        opts.cookie,
      );
    }

    if (this.opts.cors) {
      this.use(require("cors")(this.opts.cors));
    }

    if (opts.perMessageDeflate) {
      this.opts.perMessageDeflate = Object.assign(
        {
          threshold: 1024,
        },
        opts.perMessageDeflate,
      );
    }

    this.init();
  }

  protected abstract init(): void;

  /**
   * Compute the pathname of the requests that are handled by the server
   * @param options
   * @protected
   */
  protected _computePath(options: AttachOptions) {
    let path = (options.path || "/engine.io").replace(/\/$/, "");

    if (options.addTrailingSlash !== false) {
      // normalize path
      path += "/";
    }

    return path;
  }

  /**
   * Returns a list of available transports for upgrade given a certain transport.
   */
  public upgrades(transport: TransportName): string[] {
    if (!this.opts.allowUpgrades) return [];
    return transports[transport].upgradesTo || [];
  }

  /**
   * Verifies a request.
   *
   * @param {EngineRequest} req
   * @param upgrade - whether it's an upgrade request
   * @param fn
   * @protected
   * @return whether the request is valid
   */
  protected verify(
    req: EngineRequest,
    upgrade: boolean,
    fn: ErrorCallback,
  ): void | boolean {
    // transport check
    const transport = req._query.transport;
    // WebTransport does not go through the verify() method, see the onWebTransportSession() method
    if (
      !~this.opts.transports.indexOf(transport as TransportName) ||
      transport === "webtransport"
    ) {
      debug('unknown transport "%s"', transport);
      return fn(Server.errors.UNKNOWN_TRANSPORT, { transport });
    }

    // 'Origin' header check
    const isOriginInvalid = checkInvalidHeaderChar(req.headers.origin);
    if (isOriginInvalid) {
      const origin = req.headers.origin;
      req.headers.origin = null;
      debug("origin header invalid");
      return fn(Server.errors.BAD_REQUEST, {
        name: "INVALID_ORIGIN",
        origin,
      });
    }

    // sid check
    const sid = req._query.sid;
    if (sid) {
      if (!this.clients.hasOwnProperty(sid)) {
        debug('unknown sid "%s"', sid);
        return fn(Server.errors.UNKNOWN_SID, {
          sid,
        });
      }
      const previousTransport = this.clients[sid].transport.name;
      if (!upgrade && previousTransport !== transport) {
        debug("bad request: unexpected transport without upgrade");
        return fn(Server.errors.BAD_REQUEST, {
          name: "TRANSPORT_MISMATCH",
          transport,
          previousTransport,
        });
      }
    } else {
      // handshake is GET only
      if ("GET" !== req.method) {
        return fn(Server.errors.BAD_HANDSHAKE_METHOD, {
          method: req.method,
        });
      }

      if (transport === "websocket" && !upgrade) {
        debug("invalid transport upgrade");
        return fn(Server.errors.BAD_REQUEST, {
          name: "TRANSPORT_HANDSHAKE_ERROR",
        });
      }

      if (!this.opts.allowRequest) return fn();

      return this.opts.allowRequest(req, (message, success) => {
        if (!success) {
          return fn(Server.errors.FORBIDDEN, {
            message,
          });
        }
        fn();
      });
    }

    fn();
  }

  /**
   * Adds a new middleware.
   *
   * @example
   * import helmet from "helmet";
   *
   * engine.use(helmet());
   *
   * @param fn
   */
  public use(fn: any) {
    this.middlewares.push(fn);
  }

  /**
   * Apply the middlewares to the request.
   *
   * @param req
   * @param res
   * @param callback
   * @protected
   */
  protected _applyMiddlewares(
    req: IncomingMessage,
    res: ServerResponse,
    callback: (err?: any) => void,
  ) {
    if (this.middlewares.length === 0) {
      debug("no middleware to apply, skipping");
      return callback();
    }

    const apply = (i) => {
      debug("applying middleware n°%d", i + 1);
      this.middlewares[i](req, res, (err?: any) => {
        if (err) {
          return callback(err);
        }

        if (i + 1 < this.middlewares.length) {
          apply(i + 1);
        } else {
          callback();
        }
      });
    };

    apply(0);
  }

  /**
   * Closes all clients.
   */
  public close() {
    debug("closing all open clients");
    for (let i in this.clients) {
      if (this.clients.hasOwnProperty(i)) {
        this.clients[i].close(true);
      }
    }
    this.cleanup();
    return this;
  }

  protected abstract cleanup();

  /**
   * generate a socket id.
   * Overwrite this method to generate your custom socket id
   *
   * @param {IncomingMessage} req - the request object
   */
  public generateId(req: IncomingMessage): string | PromiseLike<string> {
    return base64id.generateId();
  }

  /**
   * Handshakes a new client.
   *
   * @param {String} transportName
   * @param {Object} req - the request object
   * @param {Function} closeConnection
   *
   * @protected
   */
  protected async handshake(
    transportName: TransportName,
    req: EngineRequest,
    closeConnection: ErrorCallback,
  ) {
    const protocol = req._query.EIO === "4" ? 4 : 3; // 3rd revision by default
    if (protocol === 3 && !this.opts.allowEIO3) {
      debug("unsupported protocol version");
      this.emit("connection_error", {
        req,
        code: Server.errors.UNSUPPORTED_PROTOCOL_VERSION,
        message:
          Server.errorMessages[Server.errors.UNSUPPORTED_PROTOCOL_VERSION],
        context: {
          protocol,
        },
      });
      closeConnection(Server.errors.UNSUPPORTED_PROTOCOL_VERSION);
      return;
    }

    let id;
    try {
      id = await this.generateId(req);
    } catch (e) {
      debug("error while generating an id");
      this.emit("connection_error", {
        req,
        code: Server.errors.BAD_REQUEST,
        message: Server.errorMessages[Server.errors.BAD_REQUEST],
        context: {
          name: "ID_GENERATION_ERROR",
          error: e,
        },
      });
      closeConnection(Server.errors.BAD_REQUEST);
      return;
    }

    debug('handshaking client "%s"', id);

    try {
      var transport = this.createTransport(transportName, req);
      if ("polling" === transportName) {
        transport.maxHttpBufferSize = this.opts.maxHttpBufferSize;
        transport.httpCompression = this.opts.httpCompression;
      } else if ("websocket" === transportName) {
        transport.perMessageDeflate = this.opts.perMessageDeflate;
      }
    } catch (e) {
      debug('error handshaking to transport "%s"', transportName);
      this.emit("connection_error", {
        req,
        code: Server.errors.BAD_REQUEST,
        message: Server.errorMessages[Server.errors.BAD_REQUEST],
        context: {
          name: "TRANSPORT_HANDSHAKE_ERROR",
          error: e,
        },
      });
      closeConnection(Server.errors.BAD_REQUEST);
      return;
    }
    const socket = new Socket(id, this, transport, req, protocol);

    transport.on("headers", (headers, req) => {
      const isInitialRequest = !req._query.sid;

      if (isInitialRequest) {
        if (this.opts.cookie) {
          headers["Set-Cookie"] = [
            // @ts-ignore
            serialize(this.opts.cookie.name, id, this.opts.cookie),
          ];
        }
        this.emit("initial_headers", headers, req);
      }
      this.emit("headers", headers, req);
    });

    transport.onRequest(req);

    this.clients[id] = socket;
    this.clientsCount++;

    socket.once("close", () => {
      delete this.clients[id];
      this.clientsCount--;
    });

    this.emit("connection", socket);

    return transport;
  }

  public async onWebTransportSession(session: any) {
    const timeout = setTimeout(() => {
      debug(
        "the client failed to establish a bidirectional stream in the given period",
      );
      session.close();
    }, this.opts.upgradeTimeout);

    const streamReader = session.incomingBidirectionalStreams.getReader();
    const result = await streamReader.read();

    if (result.done) {
      debug("session is closed");
      return;
    }

    const stream = result.value;
    const transformStream = createPacketDecoderStream(
      this.opts.maxHttpBufferSize,
      "nodebuffer",
    );
    const reader = stream.readable.pipeThrough(transformStream).getReader();

    // reading the first packet of the stream
    const { value, done } = await reader.read();
    if (done) {
      debug("stream is closed");
      return;
    }

    clearTimeout(timeout);

    if (value.type !== "open") {
      debug("invalid WebTransport handshake");
      return session.close();
    }

    if (value.data === undefined) {
      const transport = new WebTransport(session, stream, reader);

      // note: we cannot use "this.generateId()", because there is no "req" argument
      const id = base64id.generateId();
      debug('handshaking client "%s" (WebTransport)', id);

      const socket = new Socket(id, this, transport, null, 4);

      this.clients[id] = socket;
      this.clientsCount++;

      socket.once("close", () => {
        delete this.clients[id];
        this.clientsCount--;
      });

      this.emit("connection", socket);
      return;
    }

    const sid = parseSessionId(value.data);

    if (!sid) {
      debug("invalid WebTransport handshake");
      return session.close();
    }

    const client = this.clients[sid];

    if (!client) {
      debug("upgrade attempt for closed client");
      session.close();
    } else if (client.upgrading) {
      debug("transport has already been trying to upgrade");
      session.close();
    } else if (client.upgraded) {
      debug("transport had already been upgraded");
      session.close();
    } else {
      debug("upgrading existing transport");

      const transport = new WebTransport(session, stream, reader);
      client._maybeUpgrade(transport);
    }
  }

  protected abstract createTransport(
    transportName: TransportName,
    req: EngineRequest,
  );

  /**
   * Protocol errors mappings.
   */

  static errors = {
    UNKNOWN_TRANSPORT: 0,
    UNKNOWN_SID: 1,
    BAD_HANDSHAKE_METHOD: 2,
    BAD_REQUEST: 3,
    FORBIDDEN: 4,
    UNSUPPORTED_PROTOCOL_VERSION: 5,
  } as const;

  static errorMessages = {
    0: "Transport unknown",
    1: "Session ID unknown",
    2: "Bad handshake method",
    3: "Bad request",
    4: "Forbidden",
    5: "Unsupported protocol version",
  } as const;
}

/**
 * Exposes a subset of the http.ServerResponse interface, in order to be able to apply the middlewares to an upgrade
 * request.
 *
 * @see https://nodejs.org/api/http.html#class-httpserverresponse
 */
class WebSocketResponse {
  constructor(
    readonly req,
    readonly socket: Duplex,
  ) {
    // temporarily store the response headers on the req object (see the "headers" event)
    req[kResponseHeaders] = {};
  }

  public setHeader(name: string, value: any) {
    this.req[kResponseHeaders][name] = value;
  }

  public getHeader(name: string) {
    return this.req[kResponseHeaders][name];
  }

  public removeHeader(name: string) {
    delete this.req[kResponseHeaders][name];
  }

  public write() {}

  public writeHead() {}

  public end() {
    // we could return a proper error code, but the WebSocket client will emit an "error" event anyway.
    this.socket.destroy();
  }
}

/**
 * An Engine.IO server based on Node.js built-in HTTP server and the `ws` package for WebSocket connections.
 */
export class Server extends BaseServer {
  public httpServer?: HttpServer;
  private ws: WsServer;

  /**
   * Initialize websocket server
   *
   * @protected
   */
  protected init() {
    if (!~this.opts.transports.indexOf("websocket")) return;

    if (this.ws) this.ws.close();

    this.ws = new this.opts.wsEngine({
      noServer: true,
      clientTracking: false,
      perMessageDeflate: this.opts.perMessageDeflate,
      maxPayload: this.opts.maxHttpBufferSize,
    });

    if (typeof this.ws.on === "function") {
      this.ws.on("headers", (headersArray, req: EngineRequest) => {
        // note: 'ws' uses an array of headers, while Engine.IO uses an object (response.writeHead() accepts both formats)
        // we could also try to parse the array and then sync the values, but that will be error-prone
        const additionalHeaders = req[kResponseHeaders] || {};
        delete req[kResponseHeaders];

        const isInitialRequest = !req._query.sid;
        if (isInitialRequest) {
          this.emit("initial_headers", additionalHeaders, req);
        }

        this.emit("headers", additionalHeaders, req);

        debug("writing headers: %j", additionalHeaders);
        Object.keys(additionalHeaders).forEach((key) => {
          headersArray.push(`${key}: ${additionalHeaders[key]}`);
        });
      });
    }
  }

  protected cleanup() {
    if (this.ws) {
      debug("closing webSocketServer");
      this.ws.close();
      // don't delete this.ws because it can be used again if the http server starts listening again
    }
  }

  /**
   * Prepares a request by processing the query string.
   *
   * @private
   */
  private prepare(req: EngineRequest) {
    // try to leverage pre-existing `req._query` (e.g: from connect)
    if (!req._query) {
      req._query = (
        ~req.url.indexOf("?") ? qs.parse(parse(req.url).query) : {}
      ) as Record<string, string>;
    }
  }

  protected createTransport(
    transportName: TransportName,
    req: IncomingMessage,
  ): Transport {
    // @ts-expect-error 'polling' is a plain function used as constructor
    return new transports[transportName](req);
  }

  /**
   * Handles an Engine.IO HTTP request.
   *
   * @param {EngineRequest} req
   * @param {ServerResponse} res
   */
  public handleRequest(req: EngineRequest, res: ServerResponse) {
    debug('handling "%s" http request "%s"', req.method, req.url);
    this.prepare(req);
    req.res = res;

    const callback: ErrorCallback = (errorCode, errorContext) => {
      if (errorCode !== undefined) {
        this.emit("connection_error", {
          req,
          code: errorCode,
          message: Server.errorMessages[errorCode],
          context: errorContext,
        });
        abortRequest(res, errorCode, errorContext);
        return;
      }

      if (req._query.sid) {
        debug("setting new request for existing client");
        this.clients[req._query.sid].transport.onRequest(req);
      } else {
        const closeConnection = (errorCode, errorContext) =>
          abortRequest(res, errorCode, errorContext);
        this.handshake(
          req._query.transport as TransportName,
          req,
          closeConnection,
        );
      }
    };

    this._applyMiddlewares(req, res, (err) => {
      if (err) {
        callback(Server.errors.BAD_REQUEST, { name: "MIDDLEWARE_FAILURE" });
      } else {
        this.verify(req, false, callback);
      }
    });
  }

  /**
   * Handles an Engine.IO HTTP Upgrade.
   */
  public handleUpgrade(
    req: EngineRequest,
    socket: Duplex,
    upgradeHead: Buffer,
  ) {
    this.prepare(req);

    const res = new WebSocketResponse(req, socket);
    const callback: ErrorCallback = (errorCode, errorContext) => {
      if (errorCode !== undefined) {
        this.emit("connection_error", {
          req,
          code: errorCode,
          message: Server.errorMessages[errorCode],
          context: errorContext,
        });
        abortUpgrade(socket, errorCode, errorContext);
        return;
      }

      const head = Buffer.from(upgradeHead);
      upgradeHead = null;

      // some middlewares (like express-session) wait for the writeHead() call to flush their headers
      // see https://github.com/expressjs/session/blob/1010fadc2f071ddf2add94235d72224cf65159c6/index.js#L220-L244
      res.writeHead();

      // delegate to ws
      this.ws.handleUpgrade(req, socket, head, (websocket) => {
        this.onWebSocket(req, socket, websocket);
      });
    };

    this._applyMiddlewares(req, res as unknown as ServerResponse, (err) => {
      if (err) {
        callback(Server.errors.BAD_REQUEST, { name: "MIDDLEWARE_FAILURE" });
      } else {
        this.verify(req, true, callback);
      }
    });
  }

  /**
   * Called upon a ws.io connection.
   * @param req
   * @param socket
   * @param websocket
   * @private
   */
  private onWebSocket(
    req: EngineRequest,
    socket: Duplex,
    websocket: WsWebSocket,
  ) {
    websocket.on("error", onUpgradeError);

    if (
      transports[req._query.transport] !== undefined &&
      !transports[req._query.transport].prototype.handlesUpgrades
    ) {
      debug("transport doesnt handle upgraded requests");
      websocket.close();
      return;
    }

    // get client id
    const id = req._query.sid;

    // keep a reference to the ws.Socket
    req.websocket = websocket;

    if (id) {
      const client = this.clients[id];
      if (!client) {
        debug("upgrade attempt for closed client");
        websocket.close();
      } else if (client.upgrading) {
        debug("transport has already been trying to upgrade");
        websocket.close();
      } else if (client.upgraded) {
        debug("transport had already been upgraded");
        websocket.close();
      } else {
        debug("upgrading existing transport");

        // transport error handling takes over
        websocket.removeListener("error", onUpgradeError);

        const transport = this.createTransport(
          req._query.transport as TransportName,
          req,
        );
        // @ts-expect-error this option is only for WebSocket impl
        transport.perMessageDeflate = this.opts.perMessageDeflate;
        client._maybeUpgrade(transport);
      }
    } else {
      const closeConnection = (errorCode, errorContext) =>
        abortUpgrade(socket, errorCode, errorContext);
      this.handshake(
        req._query.transport as TransportName,
        req,
        closeConnection,
      );
    }

    function onUpgradeError() {
      debug("websocket error before upgrade");
      // websocket.close() not needed
    }
  }

  /**
   * Captures upgrade requests for a http.Server.
   *
   * @param {http.Server} server
   * @param {Object} options
   */
  public attach(server: HttpServer, options: AttachOptions = {}) {
    const path = this._computePath(options);
    const destroyUpgradeTimeout = options.destroyUpgradeTimeout || 1000;

    function check(req) {
      // TODO use `path === new URL(...).pathname` in the next major release (ref: https://nodejs.org/api/url.html)
      return path === req.url.slice(0, path.length);
    }

    // cache and clean up listeners
    const listeners = server.listeners("request").slice(0);
    server.removeAllListeners("request");
    server.on("close", this.close.bind(this));
    server.on("listening", this.init.bind(this));

    // add request handler
    server.on("request", (req, res) => {
      if (check(req)) {
        debug('intercepting request for path "%s"', path);
        this.handleRequest(req as EngineRequest, res);
      } else {
        let i = 0;
        const l = listeners.length;
        for (; i < l; i++) {
          listeners[i].call(server, req, res);
        }
      }
    });

    if (~this.opts.transports.indexOf("websocket")) {
      server.on("upgrade", (req, socket, head) => {
        if (check(req)) {
          this.handleUpgrade(req as EngineRequest, socket, head);
        } else if (false !== options.destroyUpgrade) {
          // default node behavior is to disconnect when no handlers
          // but by adding a handler, we prevent that
          // and if no eio thing handles the upgrade
          // then the socket needs to die!
          setTimeout(function () {
            // @ts-ignore
            if (socket.writable && socket.bytesWritten <= 0) {
              socket.on("error", (e) => {
                debug("error while destroying upgrade: %s", e.message);
              });
              return socket.end();
            }
          }, destroyUpgradeTimeout);
        }
      });
    }
  }
}

/**
 * Close the HTTP long-polling request
 *
 * @param res - the response object
 * @param errorCode - the error code
 * @param errorContext - additional error context
 *
 * @private
 */

function abortRequest(
  res: ServerResponse,
  errorCode: number,
  errorContext?: { message?: string },
) {
  const statusCode = errorCode === Server.errors.FORBIDDEN ? 403 : 400;
  const message =
    errorContext && errorContext.message
      ? errorContext.message
      : Server.errorMessages[errorCode];

  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      code: errorCode,
      message,
    }),
  );
}

/**
 * Close the WebSocket connection
 *
 * @param {net.Socket} socket
 * @param {string} errorCode - the error code
 * @param {object} errorContext - additional error context
 */

function abortUpgrade(
  socket,
  errorCode,
  errorContext: { message?: string } = {},
) {
  socket.on("error", () => {
    debug("ignoring error from closed connection");
  });
  if (socket.writable) {
    const message = errorContext.message || Server.errorMessages[errorCode];
    const length = Buffer.byteLength(message);
    socket.write(
      "HTTP/1.1 400 Bad Request\r\n" +
        "Connection: close\r\n" +
        "Content-type: text/html\r\n" +
        "Content-Length: " +
        length +
        "\r\n" +
        "\r\n" +
        message,
    );
  }
  socket.destroy();
}

/* eslint-disable */

/**
 * From https://github.com/nodejs/node/blob/v8.4.0/lib/_http_common.js#L303-L354
 *
 * True if val contains an invalid field-vchar
 *  field-value    = *( field-content / obs-fold )
 *  field-content  = field-vchar [ 1*( SP / HTAB ) field-vchar ]
 *  field-vchar    = VCHAR / obs-text
 *
 * checkInvalidHeaderChar() is currently designed to be inlinable by v8,
 * so take care when making changes to the implementation so that the source
 * code size does not exceed v8's default max_inlined_source_size setting.
 **/
// prettier-ignore
const validHdrChars = [
  0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, // 0 - 15
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 16 - 31
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, // 32 - 47
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, // 48 - 63
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, // 64 - 79
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, // 80 - 95
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, // 96 - 111
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, // 112 - 127
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, // 128 ...
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1  // ... 255
]

function checkInvalidHeaderChar(val?: string) {
  val += "";
  if (val.length < 1) return false;
  if (!validHdrChars[val.charCodeAt(0)]) {
    debug('invalid header, index 0, char "%s"', val.charCodeAt(0));
    return true;
  }
  if (val.length < 2) return false;
  if (!validHdrChars[val.charCodeAt(1)]) {
    debug('invalid header, index 1, char "%s"', val.charCodeAt(1));
    return true;
  }
  if (val.length < 3) return false;
  if (!validHdrChars[val.charCodeAt(2)]) {
    debug('invalid header, index 2, char "%s"', val.charCodeAt(2));
    return true;
  }
  if (val.length < 4) return false;
  if (!validHdrChars[val.charCodeAt(3)]) {
    debug('invalid header, index 3, char "%s"', val.charCodeAt(3));
    return true;
  }
  for (let i = 4; i < val.length; ++i) {
    if (!validHdrChars[val.charCodeAt(i)]) {
      debug('invalid header, index "%i", char "%s"', i, val.charCodeAt(i));
      return true;
    }
  }
  return false;
}
