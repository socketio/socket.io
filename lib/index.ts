import http = require("http");
import { createReadStream } from "fs";
import { createDeflate, createGzip, createBrotliCompress } from "zlib";
import accepts = require("accepts");
import { pipeline } from "stream";
import path = require("path");
import engine = require("engine.io");
import { Client } from "./client";
import { EventEmitter } from "events";
import { ExtendedError, Namespace } from "./namespace";
import { ParentNamespace } from "./parent-namespace";
import { Adapter, Room, SocketId } from "socket.io-adapter";
import * as parser from "socket.io-parser";
import type { Encoder } from "socket.io-parser";
import debugModule from "debug";
import { Socket } from "./socket";
import type { CookieSerializeOptions } from "cookie";
import type { CorsOptions } from "cors";

const debug = debugModule("socket.io:server");

const clientVersion = require("../package.json").version;
const dotMapRegex = /\.map/;

type Transport = "polling" | "websocket";
type ParentNspNameMatchFn = (
  name: string,
  auth: { [key: string]: any },
  fn: (err: Error | null, success: boolean) => void
) => void;

interface EngineOptions {
  /**
   * how many ms without a pong packet to consider the connection closed
   * @default 5000
   */
  pingTimeout: number;
  /**
   * how many ms before sending a new ping packet
   * @default 25000
   */
  pingInterval: number;
  /**
   * how many ms before an uncompleted transport upgrade is cancelled
   * @default 10000
   */
  upgradeTimeout: number;
  /**
   * how many bytes or characters a message can be, before closing the session (to avoid DoS).
   * @default 1e5 (100 KB)
   */
  maxHttpBufferSize: number;
  /**
   * A function that receives a given handshake or upgrade request as its first parameter,
   * and can decide whether to continue or not. The second argument is a function that needs
   * to be called with the decided information: fn(err, success), where success is a boolean
   * value where false means that the request is rejected, and err is an error code.
   */
  allowRequest: (
    req: http.IncomingMessage,
    fn: (err: string | null | undefined, success: boolean) => void
  ) => void;
  /**
   * the low-level transports that are enabled
   * @default ["polling", "websocket"]
   */
  transports: Transport[];
  /**
   * whether to allow transport upgrades
   * @default true
   */
  allowUpgrades: boolean;
  /**
   * parameters of the WebSocket permessage-deflate extension (see ws module api docs). Set to false to disable.
   * @default false
   */
  perMessageDeflate: boolean | object;
  /**
   * parameters of the http compression for the polling transports (see zlib api docs). Set to false to disable.
   * @default true
   */
  httpCompression: boolean | object;
  /**
   * what WebSocket server implementation to use. Specified module must
   * conform to the ws interface (see ws module api docs). Default value is ws.
   * An alternative c++ addon is also available by installing uws module.
   */
  wsEngine: string;
  /**
   * an optional packet which will be concatenated to the handshake packet emitted by Engine.IO.
   */
  initialPacket: any;
  /**
   * configuration of the cookie that contains the client sid to send as part of handshake response headers. This cookie
   * might be used for sticky-session. Defaults to not sending any cookie.
   * @default false
   */
  cookie: CookieSerializeOptions | boolean;
  /**
   * the options that will be forwarded to the cors module
   */
  cors: CorsOptions;
  /**
   * whether to enable compatibility with Socket.IO v2 clients
   * @default false
   */
  allowEIO3: boolean;
}

interface AttachOptions {
  /**
   * name of the path to capture
   * @default "/engine.io"
   */
  path: string;
  /**
   * destroy unhandled upgrade requests
   * @default true
   */
  destroyUpgrade: boolean;
  /**
   * milliseconds after which unhandled requests are ended
   * @default 1000
   */
  destroyUpgradeTimeout: number;
}

interface EngineAttachOptions extends EngineOptions, AttachOptions {}

interface ServerOptions extends EngineAttachOptions {
  /**
   * name of the path to capture
   * @default "/socket.io"
   */
  path: string;
  /**
   * whether to serve the client files
   * @default true
   */
  serveClient: boolean;
  /**
   * the adapter to use
   * @default the in-memory adapter (https://github.com/socketio/socket.io-adapter)
   */
  adapter: any;
  /**
   * the parser to use
   * @default the default parser (https://github.com/socketio/socket.io-parser)
   */
  parser: any;
  /**
   * how many ms before a client without namespace is closed
   * @default 45000
   */
  connectTimeout: number;
}

export class Server extends EventEmitter {
  public readonly sockets: Namespace;

  /** @private */
  readonly _parser: typeof parser;
  /** @private */
  readonly encoder: Encoder;

  /**
   * @private
   */
  _nsps: Map<string, Namespace> = new Map();
  private parentNsps: Map<ParentNspNameMatchFn, ParentNamespace> = new Map();
  private _adapter?: typeof Adapter;
  private _serveClient: boolean;
  private opts: Partial<EngineOptions>;
  private eio;
  private engine;
  private _path: string;
  private clientPathRegex: RegExp;

  /**
   * @private
   */
  _connectTimeout: number;
  private httpServer: http.Server;

  /**
   * Server constructor.
   *
   * @param srv http server, port, or options
   * @param [opts]
   * @public
   */
  constructor(opts?: Partial<ServerOptions>);
  constructor(srv?: http.Server | number, opts?: Partial<ServerOptions>);
  constructor(
    srv: undefined | Partial<ServerOptions> | http.Server | number,
    opts?: Partial<ServerOptions>
  );
  constructor(
    srv: undefined | Partial<ServerOptions> | http.Server | number,
    opts: Partial<ServerOptions> = {}
  ) {
    super();
    if (
      "object" === typeof srv &&
      srv instanceof Object &&
      !(srv as Partial<http.Server>).listen
    ) {
      opts = srv as Partial<ServerOptions>;
      srv = undefined;
    }
    this.path(opts.path || "/socket.io");
    this.connectTimeout(opts.connectTimeout || 45000);
    this.serveClient(false !== opts.serveClient);
    this._parser = opts.parser || parser;
    this.encoder = new this._parser.Encoder();
    this.adapter(opts.adapter || Adapter);
    this.sockets = this.of("/");
    this.opts = opts;
    if (srv) this.attach(srv as http.Server);
  }

  /**
   * Sets/gets whether client code is being served.
   *
   * @param v - whether to serve client code
   * @return self when setting or value when getting
   * @public
   */
  public serveClient(v: boolean): this;
  public serveClient(): boolean;
  public serveClient(v?: boolean): this | boolean;
  public serveClient(v?: boolean): this | boolean {
    if (!arguments.length) return this._serveClient;
    this._serveClient = v!;
    return this;
  }

  /**
   * Executes the middleware for an incoming namespace not already created on the server.
   *
   * @param name - name of incoming namespace
   * @param auth - the auth parameters
   * @param fn - callback
   *
   * @private
   */
  _checkNamespace(
    name: string,
    auth: { [key: string]: any },
    fn: (nsp: Namespace | false) => void
  ): void {
    if (this.parentNsps.size === 0) return fn(false);

    const keysIterator = this.parentNsps.keys();

    const run = () => {
      const nextFn = keysIterator.next();
      if (nextFn.done) {
        return fn(false);
      }
      nextFn.value(name, auth, (err, allow) => {
        if (err || !allow) {
          run();
        } else {
          fn(this.parentNsps.get(nextFn.value)!.createChild(name));
        }
      });
    };

    run();
  }

  /**
   * Sets the client serving path.
   *
   * @param {String} v pathname
   * @return {Server|String} self when setting or value when getting
   * @public
   */
  public path(v: string): this;
  public path(): string;
  public path(v?: string): this | string;
  public path(v?: string): this | string {
    if (!arguments.length) return this._path;

    this._path = v!.replace(/\/$/, "");

    const escapedPath = this._path.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
    this.clientPathRegex = new RegExp(
      "^" +
        escapedPath +
        "/socket\\.io(\\.min|\\.msgpack\\.min)?\\.js(\\.map)?$"
    );
    return this;
  }

  /**
   * Set the delay after which a client without namespace is closed
   * @param v
   * @public
   */
  public connectTimeout(v: number): this;
  public connectTimeout(): number;
  public connectTimeout(v?: number): this | number;
  public connectTimeout(v?: number): this | number {
    if (v === undefined) return this._connectTimeout;
    this._connectTimeout = v;
    return this;
  }

  /**
   * Sets the adapter for rooms.
   *
   * @param v pathname
   * @return self when setting or value when getting
   * @public
   */
  public adapter(): typeof Adapter | undefined;
  public adapter(v: typeof Adapter): this;
  public adapter(v?: typeof Adapter): typeof Adapter | undefined | this;
  public adapter(v?: typeof Adapter): typeof Adapter | undefined | this {
    if (!arguments.length) return this._adapter;
    this._adapter = v;
    for (const nsp of this._nsps.values()) {
      nsp._initAdapter();
    }
    return this;
  }

  /**
   * Attaches socket.io to a server or port.
   *
   * @param srv - server or port
   * @param opts - options passed to engine.io
   * @return self
   * @public
   */
  public listen(
    srv: http.Server | number,
    opts: Partial<ServerOptions> = {}
  ): this {
    return this.attach(srv, opts);
  }

  /**
   * Attaches socket.io to a server or port.
   *
   * @param srv - server or port
   * @param opts - options passed to engine.io
   * @return self
   * @public
   */
  public attach(
    srv: http.Server | number,
    opts: Partial<ServerOptions> = {}
  ): this {
    if ("function" == typeof srv) {
      const msg =
        "You are trying to attach socket.io to an express " +
        "request handler function. Please pass a http.Server instance.";
      throw new Error(msg);
    }

    // handle a port as a string
    if (Number(srv) == srv) {
      srv = Number(srv);
    }

    if ("number" == typeof srv) {
      debug("creating http server and binding to %d", srv);
      const port = srv;
      srv = http.createServer((req, res) => {
        res.writeHead(404);
        res.end();
      });
      srv.listen(port);
    }

    // merge the options passed to the Socket.IO server
    Object.assign(opts, this.opts);
    // set engine.io path to `/socket.io`
    opts.path = opts.path || this._path;

    this.initEngine(srv, opts);

    return this;
  }

  /**
   * Initialize engine
   *
   * @param srv - the server to attach to
   * @param opts - options passed to engine.io
   * @private
   */
  private initEngine(
    srv: http.Server,
    opts: Partial<EngineAttachOptions>
  ): void {
    // initialize engine
    debug("creating engine.io instance with opts %j", opts);
    this.eio = engine.attach(srv, opts);

    // attach static file serving
    if (this._serveClient) this.attachServe(srv);

    // Export http server
    this.httpServer = srv;

    // bind to engine events
    this.bind(this.eio);
  }

  /**
   * Attaches the static file serving.
   *
   * @param srv http server
   * @private
   */
  private attachServe(srv: http.Server): void {
    debug("attaching client serving req handler");

    const evs = srv.listeners("request").slice(0);
    srv.removeAllListeners("request");
    srv.on("request", (req, res) => {
      if (this.clientPathRegex.test(req.url)) {
        this.serve(req, res);
      } else {
        for (let i = 0; i < evs.length; i++) {
          evs[i].call(srv, req, res);
        }
      }
    });
  }

  /**
   * Handles a request serving of client source and map
   *
   * @param req
   * @param res
   * @private
   */
  private serve(req: http.IncomingMessage, res: http.ServerResponse): void {
    const filename = req.url!.replace(this._path, "");
    const isMap = dotMapRegex.test(filename);
    const type = isMap ? "map" : "source";

    // Per the standard, ETags must be quoted:
    // https://tools.ietf.org/html/rfc7232#section-2.3
    const expectedEtag = '"' + clientVersion + '"';
    const weakEtag = "W/" + expectedEtag;

    const etag = req.headers["if-none-match"];
    if (etag) {
      if (expectedEtag === etag || weakEtag === etag) {
        debug("serve client %s 304", type);
        res.writeHead(304);
        res.end();
        return;
      }
    }

    debug("serve client %s", type);

    res.setHeader("Cache-Control", "public, max-age=0");
    res.setHeader(
      "Content-Type",
      "application/" + (isMap ? "json" : "javascript")
    );
    res.setHeader("ETag", expectedEtag);

    if (!isMap) {
      res.setHeader("X-SourceMap", filename.substring(1) + ".map");
    }
    Server.sendFile(filename, req, res);
  }

  /**
   * @param filename
   * @param req
   * @param res
   * @private
   */
  private static sendFile(
    filename: string,
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): void {
    const readStream = createReadStream(
      path.join(__dirname, "../client-dist/", filename)
    );
    const encoding = accepts(req).encodings(["br", "gzip", "deflate"]);

    const onError = (err: NodeJS.ErrnoException | null) => {
      if (err) {
        res.end();
      }
    };

    switch (encoding) {
      case "br":
        res.writeHead(200, { "content-encoding": "br" });
        readStream.pipe(createBrotliCompress()).pipe(res);
        pipeline(readStream, createBrotliCompress(), res, onError);
        break;
      case "gzip":
        res.writeHead(200, { "content-encoding": "gzip" });
        pipeline(readStream, createGzip(), res, onError);
        break;
      case "deflate":
        res.writeHead(200, { "content-encoding": "deflate" });
        pipeline(readStream, createDeflate(), res, onError);
        break;
      default:
        res.writeHead(200);
        pipeline(readStream, res, onError);
    }
  }

  /**
   * Binds socket.io to an engine.io instance.
   *
   * @param {engine.Server} engine engine.io (or compatible) server
   * @return self
   * @public
   */
  public bind(engine): this {
    this.engine = engine;
    this.engine.on("connection", this.onconnection.bind(this));
    return this;
  }

  /**
   * Called with each incoming transport connection.
   *
   * @param {engine.Socket} conn
   * @return self
   * @private
   */
  private onconnection(conn): this {
    debug("incoming connection with id %s", conn.id);
    const client = new Client(this, conn);
    if (conn.protocol === 3) {
      // @ts-ignore
      client.connect("/");
    }
    return this;
  }

  /**
   * Looks up a namespace.
   *
   * @param {String|RegExp|Function} name nsp name
   * @param fn optional, nsp `connection` ev handler
   * @public
   */
  public of(
    name: string | RegExp | ParentNspNameMatchFn,
    fn?: (socket: Socket) => void
  ): Namespace {
    if (typeof name === "function" || name instanceof RegExp) {
      const parentNsp = new ParentNamespace(this);
      debug("initializing parent namespace %s", parentNsp.name);
      if (typeof name === "function") {
        this.parentNsps.set(name, parentNsp);
      } else {
        this.parentNsps.set(
          (nsp, conn, next) => next(null, (name as RegExp).test(nsp)),
          parentNsp
        );
      }
      if (fn) {
        // @ts-ignore
        parentNsp.on("connect", fn);
      }
      return parentNsp;
    }

    if (String(name)[0] !== "/") name = "/" + name;

    let nsp = this._nsps.get(name);
    if (!nsp) {
      debug("initializing namespace %s", name);
      nsp = new Namespace(this, name);
      this._nsps.set(name, nsp);
    }
    if (fn) nsp.on("connect", fn);
    return nsp;
  }

  /**
   * Closes server connection
   *
   * @param [fn] optional, called as `fn([err])` on error OR all conns closed
   * @public
   */
  public close(fn?: (err?: Error) => void): void {
    for (const socket of this.sockets.sockets.values()) {
      socket._onclose("server shutting down");
    }

    this.engine.close();

    if (this.httpServer) {
      this.httpServer.close(fn);
    } else {
      fn && fn();
    }
  }

  /**
   * Sets up namespace middleware.
   *
   * @return self
   * @public
   */
  public use(
    fn: (socket: Socket, next: (err?: ExtendedError) => void) => void
  ): this {
    this.sockets.use(fn);
    return this;
  }

  /**
   * Targets a room when emitting.
   *
   * @param name
   * @return self
   * @public
   */
  public to(name: Room): this {
    this.sockets.to(name);
    return this;
  }

  /**
   * Targets a room when emitting.
   *
   * @param name
   * @return self
   * @public
   */
  public in(name: Room): this {
    this.sockets.in(name);
    return this;
  }

  /**
   * Sends a `message` event to all clients.
   *
   * @return self
   * @public
   */
  public send(...args: readonly any[]): this {
    this.sockets.emit("message", ...args);
    return this;
  }

  /**
   * Sends a `message` event to all clients.
   *
   * @return self
   * @public
   */
  public write(...args: readonly any[]): this {
    this.sockets.emit("message", ...args);
    return this;
  }

  /**
   * Gets a list of socket ids.
   *
   * @public
   */
  public allSockets(): Promise<Set<SocketId>> {
    return this.sockets.allSockets();
  }

  /**
   * Sets the compress flag.
   *
   * @param compress - if `true`, compresses the sending data
   * @return self
   * @public
   */
  public compress(compress: boolean): this {
    this.sockets.compress(compress);
    return this;
  }

  /**
   * Sets a modifier for a subsequent event emission that the event data may be lost if the client is not ready to
   * receive messages (because of network slowness or other issues, or because they’re connected through long polling
   * and is in the middle of a request-response cycle).
   *
   * @return self
   * @public
   */
  public get volatile(): this {
    this.sockets.volatile;
    return this;
  }

  /**
   * Sets a modifier for a subsequent event emission that the event data will only be broadcast to the current node.
   *
   * @return self
   * @public
   */
  public get local(): this {
    this.sockets.local;
    return this;
  }
}

/**
 * Expose main namespace (/).
 */

const emitterMethods = Object.keys(EventEmitter.prototype).filter(function (
  key
) {
  return typeof EventEmitter.prototype[key] === "function";
});

emitterMethods.forEach(function (fn) {
  Server.prototype[fn] = function () {
    return this.sockets[fn].apply(this.sockets, arguments);
  };
});

module.exports = (srv?, opts?) => new Server(srv, opts);
module.exports.Server = Server;

export { Socket, ServerOptions, Namespace };
