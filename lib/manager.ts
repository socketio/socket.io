import {
  Socket as Engine,
  SocketOptions as EngineOptions,
  installTimerFunctions,
  nextTick,
} from "engine.io-client";
import { Socket, SocketOptions, DisconnectDescription } from "./socket.js";
import * as parser from "socket.io-parser";
import { Decoder, Encoder, Packet } from "socket.io-parser";
import { on } from "./on.js";
import { Backoff } from "./contrib/backo2.js";
import {
  DefaultEventsMap,
  EventsMap,
  Emitter,
} from "@socket.io/component-emitter";
import debugModule from "debug"; // debug()

const debug = debugModule("socket.io-client:manager"); // debug()

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
   * the parser to use. Defaults to an instance of the Parser that ships with socket.io.
   */
  parser: any;
}

interface ManagerReservedEvents {
  open: () => void;
  error: (err: Error) => void;
  ping: () => void;
  packet: (packet: Packet) => void;
  close: (reason: string, description?: DisconnectDescription) => void;
  reconnect_failed: () => void;
  reconnect_attempt: (attempt: number) => void;
  reconnect_error: (err: Error) => void;
  reconnect: (attempt: number) => void;
}

export class Manager<
  ListenEvents extends EventsMap = DefaultEventsMap,
  EmitEvents extends EventsMap = ListenEvents
> extends Emitter<{}, {}, ManagerReservedEvents> {
  /**
   * The Engine.IO client instance
   *
   * @public
   */
  public engine: Engine;
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
  // @ts-ignore
  private backoff: Backoff;
  private setTimeoutFn: typeof setTimeout;
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
    installTimerFunctions(this, opts);
    this.reconnection(opts.reconnection !== false);
    this.reconnectionAttempts(opts.reconnectionAttempts || Infinity);
    this.reconnectionDelay(opts.reconnectionDelay || 1000);
    this.reconnectionDelayMax(opts.reconnectionDelayMax || 5000);
    this.randomizationFactor(opts.randomizationFactor ?? 0.5);
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
    this.engine = new Engine(this.uri, this.opts);
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
      const timer = this.setTimeoutFn(() => {
        debug("connect attempt timed out after %d", timeout);
        openSubDestroy();
        socket.close();
        // @ts-ignore
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
    try {
      this.decoder.add(data);
    } catch (e) {
      this.onclose("parse error", e as Error);
    }
  }

  /**
   * Called when parser fully decodes a packet.
   *
   * @private
   */
  private ondecoded(packet): void {
    // the nextTick call prevents an exception in a user-provided event listener from triggering a disconnection due to a "parse error"
    nextTick(() => {
      this.emitReserved("packet", packet);
    }, this.setTimeoutFn);
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

    if (this._autoConnect) {
      socket.connect();
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
    this.onclose("forced close");
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
  private onclose(reason: string, description?: DisconnectDescription): void {
    debug("closed due to %s", reason);

    this.cleanup();
    this.backoff.reset();
    this._readyState = "closed";
    this.emitReserved("close", reason, description);

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
      const timer = this.setTimeoutFn(() => {
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
