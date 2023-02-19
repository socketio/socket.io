import http = require("http");
import type { Server as HTTPSServer } from "https";
import type { Http2SecureServer } from "http2";
import { createReadStream } from "fs";
import { createDeflate, createGzip, createBrotliCompress } from "zlib";
import accepts = require("accepts");
import { pipeline } from "stream";
import path = require("path");
import { attach, Server as Engine, uServer } from "engine.io";
import type {
  ServerOptions as EngineOptions,
  AttachOptions,
  BaseServer,
} from "engine.io";
import { Client } from "./client";
import { EventEmitter } from "events";
import { ExtendedError, Namespace, ServerReservedEventsMap } from "./namespace";
import { ParentNamespace } from "./parent-namespace";
import {
  Adapter,
  SessionAwareAdapter,
  Room,
  SocketId,
} from "socket.io-adapter";
import * as parser from "socket.io-parser";
import type { Encoder } from "socket.io-parser";
import debugModule from "debug";
import { Socket, DisconnectReason } from "./socket";
import type { BroadcastOperator, RemoteSocket } from "./broadcast-operator";
import {
  EventsMap,
  DefaultEventsMap,
  EventParams,
  StrictEventEmitter,
  EventNames,
  DecorateAcknowledgementsWithTimeoutAndMultipleResponses,
  AllButLast,
  Last,
  FirstArg,
  SecondArg,
} from "./typed-events";
import { patchAdapter, restoreAdapter, serveFile } from "./uws";

const debug = debugModule("socket.io:server");

const clientVersion = require("../package.json").version;
const dotMapRegex = /\.map/;

type ParentNspNameMatchFn = (
  name: string,
  auth: { [key: string]: any },
  fn: (err: Error | null, success: boolean) => void
) => void;

type AdapterConstructor = typeof Adapter | ((nsp: Namespace) => Adapter);

interface ServerOptions extends EngineOptions, AttachOptions {
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
  adapter: AdapterConstructor;
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
  /**
   * Whether to enable the recovery of connection state when a client temporarily disconnects.
   *
   * The connection state includes the missed packets, the rooms the socket was in and the `data` attribute.
   */
  connectionStateRecovery: {
    /**
     * The backup duration of the sessions and the packets.
     *
     * @default 120000 (2 minutes)
     */
    maxDisconnectionDuration?: number;
    /**
     * Whether to skip middlewares upon successful connection state recovery.
     *
     * @default true
     */
    skipMiddlewares?: boolean;
  };
  /**
   * Whether to remove child namespaces that have no sockets connected to them
   * @default false
   */
  cleanupEmptyChildNamespaces: boolean;
}

/**
 * Represents a Socket.IO server.
 *
 * @example
 * import { Server } from "socket.io";
 *
 * const io = new Server();
 *
 * io.on("connection", (socket) => {
 *   console.log(`socket ${socket.id} connected`);
 *
 *   // send an event to the client
 *   socket.emit("foo", "bar");
 *
 *   socket.on("foobar", () => {
 *     // an event was received from the client
 *   });
 *
 *   // upon disconnection
 *   socket.on("disconnect", (reason) => {
 *     console.log(`socket ${socket.id} disconnected due to ${reason}`);
 *   });
 * });
 *
 * io.listen(3000);
 */
export class Server<
  ListenEvents extends EventsMap = DefaultEventsMap,
  EmitEvents extends EventsMap = ListenEvents,
  ServerSideEvents extends EventsMap = DefaultEventsMap,
  SocketData = any
> extends StrictEventEmitter<
  ServerSideEvents,
  EmitEvents,
  ServerReservedEventsMap<
    ListenEvents,
    EmitEvents,
    ServerSideEvents,
    SocketData
  >
> {
  public readonly sockets: Namespace<
    ListenEvents,
    EmitEvents,
    ServerSideEvents,
    SocketData
  >;
  /**
   * A reference to the underlying Engine.IO server.
   *
   * @example
   * const clientsCount = io.engine.clientsCount;
   *
   */
  public engine: BaseServer;

  /** @private */
  readonly _parser: typeof parser;
  /** @private */
  readonly encoder: Encoder;

  /**
   * @private
   */
  _nsps: Map<
    string,
    Namespace<ListenEvents, EmitEvents, ServerSideEvents, SocketData>
  > = new Map();
  private parentNsps: Map<
    ParentNspNameMatchFn,
    ParentNamespace<ListenEvents, EmitEvents, ServerSideEvents, SocketData>
  > = new Map();

  /**
   * A subset of the {@link parentNsps} map, only containing {@link ParentNamespace} which are based on a regular
   * expression.
   *
   * @private
   */
  private parentNamespacesFromRegExp: Map<
    RegExp,
    ParentNamespace<ListenEvents, EmitEvents, ServerSideEvents, SocketData>
  > = new Map();

  private _adapter?: AdapterConstructor;
  private _serveClient: boolean;
  private readonly opts: Partial<ServerOptions>;
  private eio: Engine;
  private _path: string;
  private clientPathRegex: RegExp;

  /**
   * @private
   */
  _connectTimeout: number;
  private httpServer: http.Server | HTTPSServer | Http2SecureServer;

  /**
   * Server constructor.
   *
   * @param srv http server, port, or options
   * @param [opts]
   */
  constructor(opts?: Partial<ServerOptions>);
  constructor(
    srv?: http.Server | HTTPSServer | Http2SecureServer | number,
    opts?: Partial<ServerOptions>
  );
  constructor(
    srv:
      | undefined
      | Partial<ServerOptions>
      | http.Server
      | HTTPSServer
      | Http2SecureServer
      | number,
    opts?: Partial<ServerOptions>
  );
  constructor(
    srv:
      | undefined
      | Partial<ServerOptions>
      | http.Server
      | HTTPSServer
      | Http2SecureServer
      | number,
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
    this.opts = opts;
    if (opts.connectionStateRecovery) {
      opts.connectionStateRecovery = Object.assign(
        {
          maxDisconnectionDuration: 2 * 60 * 1000,
          skipMiddlewares: true,
        },
        opts.connectionStateRecovery
      );
      this.adapter(opts.adapter || SessionAwareAdapter);
    } else {
      this.adapter(opts.adapter || Adapter);
    }
    opts.cleanupEmptyChildNamespaces = !!opts.cleanupEmptyChildNamespaces;
    this.sockets = this.of("/");
    if (srv || typeof srv == "number")
      this.attach(
        srv as http.Server | HTTPSServer | Http2SecureServer | number
      );
  }

  get _opts() {
    return this.opts;
  }

  /**
   * Sets/gets whether client code is being served.
   *
   * @param v - whether to serve client code
   * @return self when setting or value when getting
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
    fn: (
      nsp:
        | Namespace<ListenEvents, EmitEvents, ServerSideEvents, SocketData>
        | false
    ) => void
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
          return run();
        }
        if (this._nsps.has(name)) {
          // the namespace was created in the meantime
          debug("dynamic namespace %s already exists", name);
          return fn(this._nsps.get(name) as Namespace);
        }
        const namespace = this.parentNsps.get(nextFn.value)!.createChild(name);
        debug("dynamic namespace %s was created", name);
        fn(namespace);
      });
    };

    run();
  }

  /**
   * Sets the client serving path.
   *
   * @param {String} v pathname
   * @return {Server|String} self when setting or value when getting
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
        "/socket\\.io(\\.msgpack|\\.esm)?(\\.min)?\\.js(\\.map)?(?:\\?|$)"
    );
    return this;
  }

  /**
   * Set the delay after which a client without namespace is closed
   * @param v
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
   */
  public adapter(): AdapterConstructor | undefined;
  public adapter(v: AdapterConstructor): this;
  public adapter(
    v?: AdapterConstructor
  ): AdapterConstructor | undefined | this {
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
   */
  public listen(
    srv: http.Server | HTTPSServer | Http2SecureServer | number,
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
   */
  public attach(
    srv: http.Server | HTTPSServer | Http2SecureServer | number,
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

  public attachApp(app /*: TemplatedApp */, opts: Partial<ServerOptions> = {}) {
    // merge the options passed to the Socket.IO server
    Object.assign(opts, this.opts);
    // set engine.io path to `/socket.io`
    opts.path = opts.path || this._path;

    // initialize engine
    debug("creating uWebSockets.js-based engine with opts %j", opts);
    const engine = new uServer(opts);

    engine.attach(app, opts);

    // bind to engine events
    this.bind(engine);

    if (this._serveClient) {
      // attach static file serving
      app.get(`${this._path}/*`, (res, req) => {
        if (!this.clientPathRegex.test(req.getUrl())) {
          req.setYield(true);
          return;
        }

        const filename = req
          .getUrl()
          .replace(this._path, "")
          .replace(/\?.*$/, "")
          .replace(/^\//, "");
        const isMap = dotMapRegex.test(filename);
        const type = isMap ? "map" : "source";

        // Per the standard, ETags must be quoted:
        // https://tools.ietf.org/html/rfc7232#section-2.3
        const expectedEtag = '"' + clientVersion + '"';
        const weakEtag = "W/" + expectedEtag;

        const etag = req.getHeader("if-none-match");
        if (etag) {
          if (expectedEtag === etag || weakEtag === etag) {
            debug("serve client %s 304", type);
            res.writeStatus("304 Not Modified");
            res.end();
            return;
          }
        }

        debug("serve client %s", type);

        res.writeHeader("cache-control", "public, max-age=0");
        res.writeHeader(
          "content-type",
          "application/" + (isMap ? "json" : "javascript") + "; charset=utf-8"
        );
        res.writeHeader("etag", expectedEtag);

        const filepath = path.join(__dirname, "../client-dist/", filename);
        serveFile(res, filepath);
      });
    }

    patchAdapter(app);
  }

  /**
   * Initialize engine
   *
   * @param srv - the server to attach to
   * @param opts - options passed to engine.io
   * @private
   */
  private initEngine(
    srv: http.Server | HTTPSServer | Http2SecureServer,
    opts: EngineOptions & AttachOptions
  ): void {
    // initialize engine
    debug("creating engine.io instance with opts %j", opts);
    this.eio = attach(srv, opts);

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
  private attachServe(
    srv: http.Server | HTTPSServer | Http2SecureServer
  ): void {
    debug("attaching client serving req handler");

    const evs = srv.listeners("request").slice(0);
    srv.removeAllListeners("request");
    srv.on("request", (req, res) => {
      if (this.clientPathRegex.test(req.url!)) {
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
    const filename = req.url!.replace(this._path, "").replace(/\?.*$/, "");
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
      "application/" + (isMap ? "json" : "javascript") + "; charset=utf-8"
    );
    res.setHeader("ETag", expectedEtag);

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
   * @param engine engine.io (or compatible) server
   * @return self
   */
  public bind(engine: BaseServer): this {
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
   * @example
   * // with a simple string
   * const myNamespace = io.of("/my-namespace");
   *
   * // with a regex
   * const dynamicNsp = io.of(/^\/dynamic-\d+$/).on("connection", (socket) => {
   *   const namespace = socket.nsp; // newNamespace.name === "/dynamic-101"
   *
   *   // broadcast to all clients in the given sub-namespace
   *   namespace.emit("hello");
   * });
   *
   * @param name - nsp name
   * @param fn optional, nsp `connection` ev handler
   */
  public of(
    name: string | RegExp | ParentNspNameMatchFn,
    fn?: (
      socket: Socket<ListenEvents, EmitEvents, ServerSideEvents, SocketData>
    ) => void
  ): Namespace<ListenEvents, EmitEvents, ServerSideEvents, SocketData> {
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
        this.parentNamespacesFromRegExp.set(name, parentNsp);
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
      for (const [regex, parentNamespace] of this.parentNamespacesFromRegExp) {
        if (regex.test(name as string)) {
          debug("attaching namespace %s to parent namespace %s", name, regex);
          return parentNamespace.createChild(name as string);
        }
      }

      debug("initializing namespace %s", name);
      nsp = new Namespace(this, name);
      this._nsps.set(name, nsp);
      if (name !== "/") {
        // @ts-ignore
        this.sockets.emitReserved("new_namespace", nsp);
      }
    }
    if (fn) nsp.on("connect", fn);
    return nsp;
  }

  /**
   * Closes server connection
   *
   * @param [fn] optional, called as `fn([err])` on error OR all conns closed
   */
  public close(fn?: (err?: Error) => void): void {
    for (const socket of this.sockets.sockets.values()) {
      socket._onclose("server shutting down");
    }

    this.engine.close();

    // restore the Adapter prototype
    restoreAdapter();

    if (this.httpServer) {
      this.httpServer.close(fn);
    } else {
      fn && fn();
    }
  }

  /**
   * Registers a middleware, which is a function that gets executed for every incoming {@link Socket}.
   *
   * @example
   * io.use((socket, next) => {
   *   // ...
   *   next();
   * });
   *
   * @param fn - the middleware function
   */
  public use(
    fn: (
      socket: Socket<ListenEvents, EmitEvents, ServerSideEvents, SocketData>,
      next: (err?: ExtendedError) => void
    ) => void
  ): this {
    this.sockets.use(fn);
    return this;
  }

  /**
   * Targets a room when emitting.
   *
   * @example
   * // the “foo” event will be broadcast to all connected clients in the “room-101” room
   * io.to("room-101").emit("foo", "bar");
   *
   * // with an array of rooms (a client will be notified at most once)
   * io.to(["room-101", "room-102"]).emit("foo", "bar");
   *
   * // with multiple chained calls
   * io.to("room-101").to("room-102").emit("foo", "bar");
   *
   * @param room - a room, or an array of rooms
   * @return a new {@link BroadcastOperator} instance for chaining
   */
  public to(room: Room | Room[]) {
    return this.sockets.to(room);
  }

  /**
   * Targets a room when emitting. Similar to `to()`, but might feel clearer in some cases:
   *
   * @example
   * // disconnect all clients in the "room-101" room
   * io.in("room-101").disconnectSockets();
   *
   * @param room - a room, or an array of rooms
   * @return a new {@link BroadcastOperator} instance for chaining
   */
  public in(room: Room | Room[]) {
    return this.sockets.in(room);
  }

  /**
   * Excludes a room when emitting.
   *
   * @example
   * // the "foo" event will be broadcast to all connected clients, except the ones that are in the "room-101" room
   * io.except("room-101").emit("foo", "bar");
   *
   * // with an array of rooms
   * io.except(["room-101", "room-102"]).emit("foo", "bar");
   *
   * // with multiple chained calls
   * io.except("room-101").except("room-102").emit("foo", "bar");
   *
   * @param room - a room, or an array of rooms
   * @return a new {@link BroadcastOperator} instance for chaining
   */
  public except(room: Room | Room[]) {
    return this.sockets.except(room);
  }

  /**
   * Emits an event and waits for an acknowledgement from all clients.
   *
   * @example
   * try {
   *   const responses = await io.timeout(1000).emitWithAck("some-event");
   *   console.log(responses); // one response per client
   * } catch (e) {
   *   // some clients did not acknowledge the event in the given delay
   * }
   *
   * @return a Promise that will be fulfilled when all clients have acknowledged the event
   */
  public emitWithAck<Ev extends EventNames<EmitEvents>>(
    ev: Ev,
    ...args: AllButLast<EventParams<EmitEvents, Ev>>
  ): Promise<SecondArg<Last<EventParams<EmitEvents, Ev>>>> {
    return this.sockets.emitWithAck(ev, ...args);
  }

  /**
   * Sends a `message` event to all clients.
   *
   * This method mimics the WebSocket.send() method.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/send
   *
   * @example
   * io.send("hello");
   *
   * // this is equivalent to
   * io.emit("message", "hello");
   *
   * @return self
   */
  public send(...args: EventParams<EmitEvents, "message">): this {
    this.sockets.emit("message", ...args);
    return this;
  }

  /**
   * Sends a `message` event to all clients. Alias of {@link send}.
   *
   * @return self
   */
  public write(...args: EventParams<EmitEvents, "message">): this {
    this.sockets.emit("message", ...args);
    return this;
  }

  /**
   * Sends a message to the other Socket.IO servers of the cluster.
   *
   * @example
   * io.serverSideEmit("hello", "world");
   *
   * io.on("hello", (arg1) => {
   *   console.log(arg1); // prints "world"
   * });
   *
   * // acknowledgements (without binary content) are supported too:
   * io.serverSideEmit("ping", (err, responses) => {
   *  if (err) {
   *     // some servers did not acknowledge the event in the given delay
   *   } else {
   *     console.log(responses); // one response per server (except the current one)
   *   }
   * });
   *
   * io.on("ping", (cb) => {
   *   cb("pong");
   * });
   *
   * @param ev - the event name
   * @param args - an array of arguments, which may include an acknowledgement callback at the end
   */
  public serverSideEmit<Ev extends EventNames<ServerSideEvents>>(
    ev: Ev,
    ...args: EventParams<
      DecorateAcknowledgementsWithTimeoutAndMultipleResponses<ServerSideEvents>,
      Ev
    >
  ): boolean {
    return this.sockets.serverSideEmit(ev, ...args);
  }

  /**
   * Sends a message and expect an acknowledgement from the other Socket.IO servers of the cluster.
   *
   * @example
   * try {
   *   const responses = await io.serverSideEmitWithAck("ping");
   *   console.log(responses); // one response per server (except the current one)
   * } catch (e) {
   *   // some servers did not acknowledge the event in the given delay
   * }
   *
   * @param ev - the event name
   * @param args - an array of arguments
   *
   * @return a Promise that will be fulfilled when all servers have acknowledged the event
   */
  public serverSideEmitWithAck<Ev extends EventNames<ServerSideEvents>>(
    ev: Ev,
    ...args: AllButLast<EventParams<ServerSideEvents, Ev>>
  ): Promise<FirstArg<Last<EventParams<ServerSideEvents, Ev>>>[]> {
    return this.sockets.serverSideEmitWithAck(ev, ...args);
  }

  /**
   * Gets a list of socket ids.
   *
   * @deprecated this method will be removed in the next major release, please use {@link Server#serverSideEmit} or
   * {@link Server#fetchSockets} instead.
   */
  public allSockets(): Promise<Set<SocketId>> {
    return this.sockets.allSockets();
  }

  /**
   * Sets the compress flag.
   *
   * @example
   * io.compress(false).emit("hello");
   *
   * @param compress - if `true`, compresses the sending data
   * @return a new {@link BroadcastOperator} instance for chaining
   */
  public compress(compress: boolean) {
    return this.sockets.compress(compress);
  }

  /**
   * Sets a modifier for a subsequent event emission that the event data may be lost if the client is not ready to
   * receive messages (because of network slowness or other issues, or because they’re connected through long polling
   * and is in the middle of a request-response cycle).
   *
   * @example
   * io.volatile.emit("hello"); // the clients may or may not receive it
   *
   * @return a new {@link BroadcastOperator} instance for chaining
   */
  public get volatile() {
    return this.sockets.volatile;
  }

  /**
   * Sets a modifier for a subsequent event emission that the event data will only be broadcast to the current node.
   *
   * @example
   * // the “foo” event will be broadcast to all connected clients on this node
   * io.local.emit("foo", "bar");
   *
   * @return a new {@link BroadcastOperator} instance for chaining
   */
  public get local() {
    return this.sockets.local;
  }

  /**
   * Adds a timeout in milliseconds for the next operation.
   *
   * @example
   * io.timeout(1000).emit("some-event", (err, responses) => {
   *   if (err) {
   *     // some clients did not acknowledge the event in the given delay
   *   } else {
   *     console.log(responses); // one response per client
   *   }
   * });
   *
   * @param timeout
   */
  public timeout(timeout: number) {
    return this.sockets.timeout(timeout);
  }

  /**
   * Returns the matching socket instances.
   *
   * Note: this method also works within a cluster of multiple Socket.IO servers, with a compatible {@link Adapter}.
   *
   * @example
   * // return all Socket instances
   * const sockets = await io.fetchSockets();
   *
   * // return all Socket instances in the "room1" room
   * const sockets = await io.in("room1").fetchSockets();
   *
   * for (const socket of sockets) {
   *   console.log(socket.id);
   *   console.log(socket.handshake);
   *   console.log(socket.rooms);
   *   console.log(socket.data);
   *
   *   socket.emit("hello");
   *   socket.join("room1");
   *   socket.leave("room2");
   *   socket.disconnect();
   * }
   */
  public fetchSockets(): Promise<RemoteSocket<EmitEvents, SocketData>[]> {
    return this.sockets.fetchSockets();
  }

  /**
   * Makes the matching socket instances join the specified rooms.
   *
   * Note: this method also works within a cluster of multiple Socket.IO servers, with a compatible {@link Adapter}.
   *
   * @example
   *
   * // make all socket instances join the "room1" room
   * io.socketsJoin("room1");
   *
   * // make all socket instances in the "room1" room join the "room2" and "room3" rooms
   * io.in("room1").socketsJoin(["room2", "room3"]);
   *
   * @param room - a room, or an array of rooms
   */
  public socketsJoin(room: Room | Room[]) {
    return this.sockets.socketsJoin(room);
  }

  /**
   * Makes the matching socket instances leave the specified rooms.
   *
   * Note: this method also works within a cluster of multiple Socket.IO servers, with a compatible {@link Adapter}.
   *
   * @example
   * // make all socket instances leave the "room1" room
   * io.socketsLeave("room1");
   *
   * // make all socket instances in the "room1" room leave the "room2" and "room3" rooms
   * io.in("room1").socketsLeave(["room2", "room3"]);
   *
   * @param room - a room, or an array of rooms
   */
  public socketsLeave(room: Room | Room[]) {
    return this.sockets.socketsLeave(room);
  }

  /**
   * Makes the matching socket instances disconnect.
   *
   * Note: this method also works within a cluster of multiple Socket.IO servers, with a compatible {@link Adapter}.
   *
   * @example
   * // make all socket instances disconnect (the connections might be kept alive for other namespaces)
   * io.disconnectSockets();
   *
   * // make all socket instances in the "room1" room disconnect and close the underlying connections
   * io.in("room1").disconnectSockets(true);
   *
   * @param close - whether to close the underlying connection
   */
  public disconnectSockets(close: boolean = false) {
    return this.sockets.disconnectSockets(close);
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
module.exports.Namespace = Namespace;
module.exports.Socket = Socket;

export {
  Socket,
  DisconnectReason,
  ServerOptions,
  Namespace,
  BroadcastOperator,
  RemoteSocket,
};
export { Event } from "./socket";
