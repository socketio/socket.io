import * as eio from "engine.io-client";
import { Socket, SocketOptions } from "./socket";
import * as parser from "socket.io-parser";
import { Decoder, Encoder, Packet } from "socket.io-parser";
import { on } from "./on";
import * as Backoff from "backo2";
import {
  DefaultEventsMap,
  EventsMap,
  StrictEventEmitter,
} from "./typed-events";

const debug = require("debug")("socket.io-client:manager");

interface EngineOptions {
  /**
   * The host that we're connecting to. Set from the URI passed when connecting
   */
  host: string;

  /**
   * The hostname for our connection. Set from the URI passed when connecting
   */
  hostname: string;

  /**
   * If this is a secure connection. Set from the URI passed when connecting
   */
  secure: boolean;

  /**
   * The port for our connection. Set from the URI passed when connecting
   */
  port: string;

  /**
   * Any query parameters in our uri. Set from the URI passed when connecting
   */
  query: { [key: string]: string };

  /**
   * `http.Agent` to use, defaults to `false` (NodeJS only)
   */
  agent: string | boolean;

  /**
   * Whether the client should try to upgrade the transport from
   * long-polling to something better.
   * @default true
   */
  upgrade: boolean;

  /**
   * Forces JSONP for polling transport.
   */
  forceJSONP: boolean;

  /**
   * Determines whether to use JSONP when necessary for polling. If
   * disabled (by settings to false) an error will be emitted (saying
   * "No transports available") if no other transports are available.
   * If another transport is available for opening a connection (e.g.
   * WebSocket) that transport will be used instead.
   * @default true
   */
  jsonp: boolean;

  /**
   * Forces base 64 encoding for polling transport even when XHR2
   * responseType is available and WebSocket even if the used standard
   * supports binary.
   */
  forceBase64: boolean;

  /**
   * Enables XDomainRequest for IE8 to avoid loading bar flashing with
   * click sound. default to `false` because XDomainRequest has a flaw
   * of not sending cookie.
   * @default false
   */
  enablesXDR: boolean;

  /**
   * The param name to use as our timestamp key
   * @default 't'
   */
  timestampParam: string;

  /**
   * Whether to add the timestamp with each transport request. Note: this
   * is ignored if the browser is IE or Android, in which case requests
   * are always stamped
   * @default false
   */
  timestampRequests: boolean;

  /**
   * A list of transports to try (in order). Engine.io always attempts to
   * connect directly with the first one, provided the feature detection test
   * for it passes.
   * @default ['polling','websocket']
   */
  transports: string[];

  /**
   * The port the policy server listens on
   * @default 843
   */
  policyPost: number;

  /**
   * If true and if the previous websocket connection to the server succeeded,
   * the connection attempt will bypass the normal upgrade process and will
   * initially try websocket. A connection attempt following a transport error
   * will use the normal upgrade process. It is recommended you turn this on
   * only when using SSL/TLS connections, or if you know that your network does
   * not block websockets.
   * @default false
   */
  rememberUpgrade: boolean;

  /**
   * Are we only interested in transports that support binary?
   */
  onlyBinaryUpgrades: boolean;

  /**
   * Transport options for Node.js client (headers etc)
   */
  transportOptions: Object;

  /**
   * (SSL) Certificate, Private key and CA certificates to use for SSL.
   * Can be used in Node.js client environment to manually specify
   * certificate information.
   */
  pfx: string;

  /**
   * (SSL) Private key to use for SSL. Can be used in Node.js client
   * environment to manually specify certificate information.
   */
  key: string;

  /**
   * (SSL) A string or passphrase for the private key or pfx. Can be
   * used in Node.js client environment to manually specify certificate
   * information.
   */
  passphrase: string;

  /**
   * (SSL) Public x509 certificate to use. Can be used in Node.js client
   * environment to manually specify certificate information.
   */
  cert: string;

  /**
   * (SSL) An authority certificate or array of authority certificates to
   * check the remote host against.. Can be used in Node.js client
   * environment to manually specify certificate information.
   */
  ca: string | string[];

  /**
   * (SSL) A string describing the ciphers to use or exclude. Consult the
   * [cipher format list]
   * (http://www.openssl.org/docs/apps/ciphers.html#CIPHER_LIST_FORMAT) for
   * details on the format.. Can be used in Node.js client environment to
   * manually specify certificate information.
   */
  ciphers: string;

  /**
   * (SSL) If true, the server certificate is verified against the list of
   * supplied CAs. An 'error' event is emitted if verification fails.
   * Verification happens at the connection level, before the HTTP request
   * is sent. Can be used in Node.js client environment to manually specify
   * certificate information.
   */
  rejectUnauthorized: boolean;

  /**
   * Headers that will be passed for each request to the server (via xhr-polling and via websockets).
   * These values then can be used during handshake or for special proxies.
   */
  extraHeaders?: { [header: string]: string };

  /**
   * Whether to include credentials (cookies, authorization headers, TLS
   * client certificates, etc.) with cross-origin XHR polling requests
   * @default false
   */
  withCredentials: boolean;
}

export interface ManagerOptions extends EngineOptions {
  /**
   * Should we force a new Manager for this connection?
   * @default false
   */
  forceNew: boolean;

  /**
   * Should we multiplex our connection (reuse existing Manager) ?
   * @default true
   */
  multiplex: boolean;

  /**
   * The path to get our client file from, in the case of the server
   * serving it
   * @default '/socket.io'
   */
  path: string;

  /**
   * Should we allow reconnections?
   * @default true
   */
  reconnection: boolean;

  /**
   * How many reconnection attempts should we try?
   * @default Infinity
   */
  reconnectionAttempts: number;

  /**
   * The time delay in milliseconds between reconnection attempts
   * @default 1000
   */
  reconnectionDelay: number;

  /**
   * The max time delay in milliseconds between reconnection attempts
   * @default 5000
   */
  reconnectionDelayMax: number;

  /**
   * Used in the exponential backoff jitter when reconnecting
   * @default 0.5
   */
  randomizationFactor: number;

  /**
   * The timeout in milliseconds for our connection attempt
   * @default 20000
   */
  timeout: number;

  /**
   * Should we automatically connect?
   * @default true
   */
  autoConnect: boolean;

  /**
   * weather we should unref the reconnect timer when it is
   * create automatically
   * @default false
   */
  autoUnref: boolean;

  /**
   * the parser to use. Defaults to an instance of the Parser that ships with socket.io.
   */
  parser: any;
}

interface ManagerReservedEvents {
  open: () => void;
  error: (err: Error) => void;
  ping: () => void;
  packet: (packet: Packet) => void;
  close: (reason: string) => void;
  reconnect_failed: () => void;
  reconnect_attempt: (attempt: number) => void;
  reconnect_error: (err: Error) => void;
  reconnect: (attempt: number) => void;
}

export class Manager<
  ListenEvents extends EventsMap = DefaultEventsMap,
  EmitEvents extends EventsMap = ListenEvents
> extends StrictEventEmitter<{}, {}, ManagerReservedEvents> {
  /**
   * The Engine.IO client instance
   *
   * @public
   */
  public engine: any;
  /**
   * @private
   */
  _autoConnect: boolean;
  /**
   * @private
   */
  _readyState: "opening" | "open" | "closed";
  /**
   * @private
   */
  _reconnecting: boolean;

  private readonly uri: string;
  public opts: Partial<ManagerOptions>;

  private nsps: Record<string, Socket> = {};
  private subs: Array<ReturnType<typeof on>> = [];
  private backoff: Backoff;
  private _reconnection: boolean;
  private _reconnectionAttempts: number;
  private _reconnectionDelay: number;
  private _randomizationFactor: number;
  private _reconnectionDelayMax: number;
  private _timeout: any;

  private encoder: Encoder;
  private decoder: Decoder;
  private skipReconnect: boolean;

  /**
   * `Manager` constructor.
   *
   * @param uri - engine instance or engine uri/opts
   * @param opts - options
   * @public
   */
  constructor(opts: Partial<ManagerOptions>);
  constructor(uri?: string, opts?: Partial<ManagerOptions>);
  constructor(
    uri?: string | Partial<ManagerOptions>,
    opts?: Partial<ManagerOptions>
  );
  constructor(
    uri?: string | Partial<ManagerOptions>,
    opts?: Partial<ManagerOptions>
  ) {
    super();
    if (uri && "object" === typeof uri) {
      opts = uri;
      uri = undefined;
    }
    opts = opts || {};

    opts.path = opts.path || "/socket.io";
    this.opts = opts;
    this.reconnection(opts.reconnection !== false);
    this.reconnectionAttempts(opts.reconnectionAttempts || Infinity);
    this.reconnectionDelay(opts.reconnectionDelay || 1000);
    this.reconnectionDelayMax(opts.reconnectionDelayMax || 5000);
    this.randomizationFactor(opts.randomizationFactor || 0.5);
    this.backoff = new Backoff({
      min: this.reconnectionDelay(),
      max: this.reconnectionDelayMax(),
      jitter: this.randomizationFactor(),
    });
    this.timeout(null == opts.timeout ? 20000 : opts.timeout);
    this._readyState = "closed";
    this.uri = uri as string;
    const _parser = opts.parser || parser;
    this.encoder = new _parser.Encoder();
    this.decoder = new _parser.Decoder();
    this._autoConnect = opts.autoConnect !== false;
    if (this._autoConnect) this.open();
  }

  /**
   * Sets the `reconnection` config.
   *
   * @param {Boolean} v - true/false if it should automatically reconnect
   * @return {Manager} self or value
   * @public
   */
  public reconnection(v: boolean): this;
  public reconnection(): boolean;
  public reconnection(v?: boolean): this | boolean;
  public reconnection(v?: boolean): this | boolean {
    if (!arguments.length) return this._reconnection;
    this._reconnection = !!v;
    return this;
  }

  /**
   * Sets the reconnection attempts config.
   *
   * @param {Number} v - max reconnection attempts before giving up
   * @return {Manager} self or value
   * @public
   */
  public reconnectionAttempts(v: number): this;
  public reconnectionAttempts(): number;
  public reconnectionAttempts(v?: number): this | number;
  public reconnectionAttempts(v?: number): this | number {
    if (v === undefined) return this._reconnectionAttempts;
    this._reconnectionAttempts = v;
    return this;
  }

  /**
   * Sets the delay between reconnections.
   *
   * @param {Number} v - delay
   * @return {Manager} self or value
   * @public
   */
  public reconnectionDelay(v: number): this;
  public reconnectionDelay(): number;
  public reconnectionDelay(v?: number): this | number;
  public reconnectionDelay(v?: number): this | number {
    if (v === undefined) return this._reconnectionDelay;
    this._reconnectionDelay = v;
    this.backoff?.setMin(v);
    return this;
  }

  /**
   * Sets the randomization factor
   *
   * @param v - the randomization factor
   * @return self or value
   * @public
   */
  public randomizationFactor(v: number): this;
  public randomizationFactor(): number;
  public randomizationFactor(v?: number): this | number;
  public randomizationFactor(v?: number): this | number {
    if (v === undefined) return this._randomizationFactor;
    this._randomizationFactor = v;
    this.backoff?.setJitter(v);
    return this;
  }

  /**
   * Sets the maximum delay between reconnections.
   *
   * @param v - delay
   * @return self or value
   * @public
   */
  public reconnectionDelayMax(v: number): this;
  public reconnectionDelayMax(): number;
  public reconnectionDelayMax(v?: number): this | number;
  public reconnectionDelayMax(v?: number): this | number {
    if (v === undefined) return this._reconnectionDelayMax;
    this._reconnectionDelayMax = v;
    this.backoff?.setMax(v);
    return this;
  }

  /**
   * Sets the connection timeout. `false` to disable
   *
   * @param v - connection timeout
   * @return self or value
   * @public
   */
  public timeout(v: number | boolean): this;
  public timeout(): number | boolean;
  public timeout(v?: number | boolean): this | number | boolean;
  public timeout(v?: number | boolean): this | number | boolean {
    if (!arguments.length) return this._timeout;
    this._timeout = v;
    return this;
  }

  /**
   * Starts trying to reconnect if reconnection is enabled and we have not
   * started reconnecting yet
   *
   * @private
   */
  private maybeReconnectOnOpen() {
    // Only try to reconnect if it's the first time we're connecting
    if (
      !this._reconnecting &&
      this._reconnection &&
      this.backoff.attempts === 0
    ) {
      // keeps reconnection from firing twice for the same reconnection loop
      this.reconnect();
    }
  }

  /**
   * Sets the current transport `socket`.
   *
   * @param {Function} fn - optional, callback
   * @return self
   * @public
   */
  public open(fn?: (err?: Error) => void): this {
    debug("readyState %s", this._readyState);
    if (~this._readyState.indexOf("open")) return this;

    debug("opening %s", this.uri);
    this.engine = eio(this.uri, this.opts);
    const socket = this.engine;
    const self = this;
    this._readyState = "opening";
    this.skipReconnect = false;

    // emit `open`
    const openSubDestroy = on(socket, "open", function () {
      self.onopen();
      fn && fn();
    });

    // emit `error`
    const errorSub = on(socket, "error", (err) => {
      debug("error");
      self.cleanup();
      self._readyState = "closed";
      this.emitReserved("error", err);
      if (fn) {
        fn(err);
      } else {
        // Only do this if there is no fn to handle the error
        self.maybeReconnectOnOpen();
      }
    });

    if (false !== this._timeout) {
      const timeout = this._timeout;
      debug("connect attempt will timeout after %d", timeout);

      if (timeout === 0) {
        openSubDestroy(); // prevents a race condition with the 'open' event
      }

      // set timer
      const timer = setTimeout(() => {
        debug("connect attempt timed out after %d", timeout);
        openSubDestroy();
        socket.close();
        socket.emit("error", new Error("timeout"));
      }, timeout);

      if (this.opts.autoUnref) {
        timer.unref();
      }

      this.subs.push(function subDestroy(): void {
        clearTimeout(timer);
      });
    }

    this.subs.push(openSubDestroy);
    this.subs.push(errorSub);

    return this;
  }

  /**
   * Alias for open()
   *
   * @return self
   * @public
   */
  public connect(fn?: (err?: Error) => void): this {
    return this.open(fn);
  }

  /**
   * Called upon transport open.
   *
   * @private
   */
  private onopen(): void {
    debug("open");

    // clear old subs
    this.cleanup();

    // mark as open
    this._readyState = "open";
    this.emitReserved("open");

    // add new subs
    const socket = this.engine;
    this.subs.push(
      on(socket, "ping", this.onping.bind(this)),
      on(socket, "data", this.ondata.bind(this)),
      on(socket, "error", this.onerror.bind(this)),
      on(socket, "close", this.onclose.bind(this)),
      on(this.decoder, "decoded", this.ondecoded.bind(this))
    );
  }

  /**
   * Called upon a ping.
   *
   * @private
   */
  private onping(): void {
    this.emitReserved("ping");
  }

  /**
   * Called with data.
   *
   * @private
   */
  private ondata(data): void {
    this.decoder.add(data);
  }

  /**
   * Called when parser fully decodes a packet.
   *
   * @private
   */
  private ondecoded(packet): void {
    this.emitReserved("packet", packet);
  }

  /**
   * Called upon socket error.
   *
   * @private
   */
  private onerror(err): void {
    debug("error", err);
    this.emitReserved("error", err);
  }

  /**
   * Creates a new socket for the given `nsp`.
   *
   * @return {Socket}
   * @public
   */
  public socket(nsp: string, opts?: Partial<SocketOptions>): Socket {
    let socket = this.nsps[nsp];
    if (!socket) {
      socket = new Socket(this, nsp, opts);
      this.nsps[nsp] = socket;
    }

    return socket;
  }

  /**
   * Called upon a socket close.
   *
   * @param socket
   * @private
   */
  _destroy(socket: Socket): void {
    const nsps = Object.keys(this.nsps);

    for (const nsp of nsps) {
      const socket = this.nsps[nsp];

      if (socket.active) {
        debug("socket %s is still active, skipping close", nsp);
        return;
      }
    }

    this._close();
  }

  /**
   * Writes a packet.
   *
   * @param packet
   * @private
   */
  _packet(packet: Partial<Packet & { query: string; options: any }>): void {
    debug("writing packet %j", packet);

    const encodedPackets = this.encoder.encode(packet as Packet);
    for (let i = 0; i < encodedPackets.length; i++) {
      this.engine.write(encodedPackets[i], packet.options);
    }
  }

  /**
   * Clean up transport subscriptions and packet buffer.
   *
   * @private
   */
  private cleanup(): void {
    debug("cleanup");

    this.subs.forEach((subDestroy) => subDestroy());
    this.subs.length = 0;

    this.decoder.destroy();
  }

  /**
   * Close the current socket.
   *
   * @private
   */
  _close(): void {
    debug("disconnect");
    this.skipReconnect = true;
    this._reconnecting = false;
    if ("opening" === this._readyState) {
      // `onclose` will not fire because
      // an open event never happened
      this.cleanup();
    }
    this.backoff.reset();
    this._readyState = "closed";
    if (this.engine) this.engine.close();
  }

  /**
   * Alias for close()
   *
   * @private
   */
  private disconnect(): void {
    return this._close();
  }

  /**
   * Called upon engine close.
   *
   * @private
   */
  private onclose(reason: string): void {
    debug("onclose");

    this.cleanup();
    this.backoff.reset();
    this._readyState = "closed";
    this.emitReserved("close", reason);

    if (this._reconnection && !this.skipReconnect) {
      this.reconnect();
    }
  }

  /**
   * Attempt a reconnection.
   *
   * @private
   */
  private reconnect(): this | void {
    if (this._reconnecting || this.skipReconnect) return this;

    const self = this;

    if (this.backoff.attempts >= this._reconnectionAttempts) {
      debug("reconnect failed");
      this.backoff.reset();
      this.emitReserved("reconnect_failed");
      this._reconnecting = false;
    } else {
      const delay = this.backoff.duration();
      debug("will wait %dms before reconnect attempt", delay);

      this._reconnecting = true;
      const timer = setTimeout(() => {
        if (self.skipReconnect) return;

        debug("attempting reconnect");
        this.emitReserved("reconnect_attempt", self.backoff.attempts);

        // check again for the case socket closed in above events
        if (self.skipReconnect) return;

        self.open((err) => {
          if (err) {
            debug("reconnect attempt error");
            self._reconnecting = false;
            self.reconnect();
            this.emitReserved("reconnect_error", err);
          } else {
            debug("reconnect success");
            self.onreconnect();
          }
        });
      }, delay);

      if (this.opts.autoUnref) {
        timer.unref();
      }

      this.subs.push(function subDestroy() {
        clearTimeout(timer);
      });
    }
  }

  /**
   * Called upon successful reconnect.
   *
   * @private
   */
  private onreconnect(): void {
    const attempt = this.backoff.attempts;
    this._reconnecting = false;
    this.backoff.reset();
    this.emitReserved("reconnect", attempt);
  }
}
