import eio from "engine.io-client";
import { Socket } from "./socket";
import Emitter from "component-emitter";
import parser from "socket.io-parser";
import { on } from "./on";
import bind from "component-bind";
import indexOf from "indexof";
import Backoff from "backo2";

const debug = require("debug")("socket.io-client:manager");

/**
 * IE6+ hasOwnProperty
 */
const has = Object.prototype.hasOwnProperty;

export class Manager extends Emitter {
  public autoConnect: boolean;
  public readyState: "opening" | "open" | "closed";
  public reconnecting: boolean;

  private readonly uri: string;
  private readonly opts: object;

  private nsps: object = {};
  private subs: Array<any> = [];
  private backoff: any;
  private _reconnection: boolean;
  private _reconnectionAttempts: number;
  private _reconnectionDelay: number;
  private _randomizationFactor: number;
  private _reconnectionDelayMax: number;
  private _timeout: any;

  private connecting: Array<Socket> = [];
  private lastPing: number = null;
  private encoding: boolean;
  private packetBuffer: Array<any> = [];
  private encoder: any;
  private decoder: any;
  private engine: any;
  private skipReconnect: boolean;

  /**
   * `Manager` constructor.
   *
   * @param {String} engine instance or engine uri/opts
   * @param {Object} options
   * @api public
   */
  constructor(uri, opts) {
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
    this.readyState = "closed";
    this.uri = uri;
    this.encoding = false;
    const _parser = opts.parser || parser;
    this.encoder = new _parser.Encoder();
    this.decoder = new _parser.Decoder();
    this.autoConnect = opts.autoConnect !== false;
    if (this.autoConnect) this.open();
  }

  /**
   * Propagate given event to sockets and emit on `this`
   *
   * @api private
   */
  emitAll(event: string, arg?) {
    super.emit(event, arg);
    for (let nsp in this.nsps) {
      if (has.call(this.nsps, nsp)) {
        this.nsps[nsp].emit(event, arg);
      }
    }
  }

  /**
   * Update `socket.id` of all sockets
   *
   * @api private
   */
  updateSocketIds() {
    for (let nsp in this.nsps) {
      if (has.call(this.nsps, nsp)) {
        this.nsps[nsp].id = this.generateId(nsp);
      }
    }
  }

  /**
   * generate `socket.id` for the given `nsp`
   *
   * @param {String} nsp
   * @return {String}
   * @api private
   */
  generateId(nsp) {
    return (nsp === "/" ? "" : nsp + "#") + this.engine.id;
  }

  /**
   * Sets the `reconnection` config.
   *
   * @param {Boolean} true/false if it should automatically reconnect
   * @return {Manager} self or value
   * @api public
   */
  reconnection(v?) {
    if (!arguments.length) return this._reconnection;
    this._reconnection = !!v;
    return this;
  }

  /**
   * Sets the reconnection attempts config.
   *
   * @param {Number} max reconnection attempts before giving up
   * @return {Manager} self or value
   * @api public
   */
  reconnectionAttempts(v?) {
    if (!arguments.length) return this._reconnectionAttempts;
    this._reconnectionAttempts = v;
    return this;
  }

  /**
   * Sets the delay between reconnections.
   *
   * @param {Number} delay
   * @return {Manager} self or value
   * @api public
   */
  reconnectionDelay(v?) {
    if (!arguments.length) return this._reconnectionDelay;
    this._reconnectionDelay = v;
    this.backoff && this.backoff.setMin(v);
    return this;
  }

  randomizationFactor(v?) {
    if (!arguments.length) return this._randomizationFactor;
    this._randomizationFactor = v;
    this.backoff && this.backoff.setJitter(v);
    return this;
  }

  /**
   * Sets the maximum delay between reconnections.
   *
   * @param {Number} delay
   * @return {Manager} self or value
   * @api public
   */
  reconnectionDelayMax(v?) {
    if (!arguments.length) return this._reconnectionDelayMax;
    this._reconnectionDelayMax = v;
    this.backoff && this.backoff.setMax(v);
    return this;
  }

  /**
   * Sets the connection timeout. `false` to disable
   *
   * @return {Manager} self or value
   * @api public
   */
  timeout(v?) {
    if (!arguments.length) return this._timeout;
    this._timeout = v;
    return this;
  }

  /**
   * Starts trying to reconnect if reconnection is enabled and we have not
   * started reconnecting yet
   *
   * @api private
   */
  maybeReconnectOnOpen() {
    // Only try to reconnect if it's the first time we're connecting
    if (
      !this.reconnecting &&
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
   * @param {Function} optional, callback
   * @return {Manager} self
   * @api public
   */
  open(fn?, opts?) {
    debug("readyState %s", this.readyState);
    if (~this.readyState.indexOf("open")) return this;

    debug("opening %s", this.uri);
    this.engine = eio(this.uri, this.opts);
    const socket = this.engine;
    const self = this;
    this.readyState = "opening";
    this.skipReconnect = false;

    // emit `open`
    const openSub = on(socket, "open", function () {
      self.onopen();
      fn && fn();
    });

    // emit `connect_error`
    const errorSub = on(socket, "error", function (data) {
      debug("connect_error");
      self.cleanup();
      self.readyState = "closed";
      self.emitAll("connect_error", data);
      if (fn) {
        const err = new Error("Connection error");
        // err.data = data;
        fn(err);
      } else {
        // Only do this if there is no fn to handle the error
        self.maybeReconnectOnOpen();
      }
    });

    // emit `connect_timeout`
    if (false !== this._timeout) {
      const timeout = this._timeout;
      debug("connect attempt will timeout after %d", timeout);

      if (timeout === 0) {
        openSub.destroy(); // prevents a race condition with the 'open' event
      }

      // set timer
      const timer = setTimeout(function () {
        debug("connect attempt timed out after %d", timeout);
        openSub.destroy();
        socket.close();
        socket.emit("error", "timeout");
        self.emitAll("connect_timeout", timeout);
      }, timeout);

      this.subs.push({
        destroy: function () {
          clearTimeout(timer);
        },
      });
    }

    this.subs.push(openSub);
    this.subs.push(errorSub);

    return this;
  }

  connect(fn, opts) {
    debug("readyState %s", this.readyState);
    if (~this.readyState.indexOf("open")) return this;

    debug("opening %s", this.uri);
    this.engine = eio(this.uri, this.opts);
    const socket = this.engine;
    const self = this;
    this.readyState = "opening";
    this.skipReconnect = false;

    // emit `open`
    const openSub = on(socket, "open", function () {
      self.onopen();
      fn && fn();
    });

    // emit `connect_error`
    const errorSub = on(socket, "error", function (data) {
      debug("connect_error");
      self.cleanup();
      self.readyState = "closed";
      self.emitAll("connect_error", data);
      if (fn) {
        const err = new Error("Connection error");
        // err.data = data;
        fn(err);
      } else {
        // Only do this if there is no fn to handle the error
        self.maybeReconnectOnOpen();
      }
    });

    // emit `connect_timeout`
    if (false !== this._timeout) {
      const timeout = this._timeout;
      debug("connect attempt will timeout after %d", timeout);

      if (timeout === 0) {
        openSub.destroy(); // prevents a race condition with the 'open' event
      }

      // set timer
      const timer = setTimeout(function () {
        debug("connect attempt timed out after %d", timeout);
        openSub.destroy();
        socket.close();
        socket.emit("error", "timeout");
        self.emitAll("connect_timeout", timeout);
      }, timeout);

      this.subs.push({
        destroy: function () {
          clearTimeout(timer);
        },
      });
    }

    this.subs.push(openSub);
    this.subs.push(errorSub);

    return this;
  }

  /**
   * Called upon transport open.
   *
   * @api private
   */
  onopen() {
    debug("open");

    // clear old subs
    this.cleanup();

    // mark as open
    this.readyState = "open";
    super.emit("open");

    // add new subs
    const socket = this.engine;
    this.subs.push(on(socket, "data", bind(this, "ondata")));
    this.subs.push(on(socket, "ping", bind(this, "onping")));
    this.subs.push(on(socket, "pong", bind(this, "onpong")));
    this.subs.push(on(socket, "error", bind(this, "onerror")));
    this.subs.push(on(socket, "close", bind(this, "onclose")));
    this.subs.push(on(this.decoder, "decoded", bind(this, "ondecoded")));
  }

  /**
   * Called upon a ping.
   *
   * @api private
   */
  onping() {
    this.lastPing = Date.now();
    this.emitAll("ping");
  }

  /**
   * Called upon a packet.
   *
   * @api private
   */
  onpong() {
    this.emitAll("pong", Date.now() - this.lastPing);
  }

  /**
   * Called with data.
   *
   * @api private
   */
  ondata(data) {
    this.decoder.add(data);
  }

  /**
   * Called when parser fully decodes a packet.
   *
   * @api private
   */
  ondecoded(packet) {
    super.emit("packet", packet);
  }

  /**
   * Called upon socket error.
   *
   * @api private
   */
  onerror(err) {
    debug("error", err);
    this.emitAll("error", err);
  }

  /**
   * Creates a new socket for the given `nsp`.
   *
   * @return {Socket}
   * @api public
   */
  socket(nsp, opts) {
    let socket = this.nsps[nsp];
    if (!socket) {
      socket = new Socket(this, nsp, opts);
      this.nsps[nsp] = socket;
      var self = this;
      socket.on("connecting", onConnecting);
      socket.on("connect", function () {
        socket.id = self.generateId(nsp);
      });

      if (this.autoConnect) {
        // manually call here since connecting event is fired before listening
        onConnecting();
      }
    }

    function onConnecting() {
      if (!~indexOf(self.connecting, socket)) {
        self.connecting.push(socket);
      }
    }

    return socket;
  }

  /**
   * Called upon a socket close.
   *
   * @param {Socket} socket
   */
  destroy(socket) {
    const index = indexOf(this.connecting, socket);
    if (~index) this.connecting.splice(index, 1);
    if (this.connecting.length) return;

    this.close();
  }

  /**
   * Writes a packet.
   *
   * @param {Object} packet
   * @api private
   */
  packet(packet) {
    debug("writing packet %j", packet);
    const self = this;
    if (packet.query && packet.type === 0) packet.nsp += "?" + packet.query;

    if (!self.encoding) {
      // encode, then write to engine with result
      self.encoding = true;
      this.encoder.encode(packet, function (encodedPackets) {
        for (let i = 0; i < encodedPackets.length; i++) {
          self.engine.write(encodedPackets[i], packet.options);
        }
        self.encoding = false;
        self.processPacketQueue();
      });
    } else {
      // add packet to the queue
      self.packetBuffer.push(packet);
    }
  }

  /**
   * If packet buffer is non-empty, begins encoding the
   * next packet in line.
   *
   * @api private
   */
  processPacketQueue() {
    if (this.packetBuffer.length > 0 && !this.encoding) {
      const pack = this.packetBuffer.shift();
      this.packet(pack);
    }
  }

  /**
   * Clean up transport subscriptions and packet buffer.
   *
   * @api private
   */
  cleanup() {
    debug("cleanup");

    const subsLength = this.subs.length;
    for (let i = 0; i < subsLength; i++) {
      const sub = this.subs.shift();
      sub.destroy();
    }

    this.packetBuffer = [];
    this.encoding = false;
    this.lastPing = null;

    this.decoder.destroy();
  }

  /**
   * Close the current socket.
   *
   * @api private
   */
  close() {
    debug("disconnect");
    this.skipReconnect = true;
    this.reconnecting = false;
    if ("opening" === this.readyState) {
      // `onclose` will not fire because
      // an open event never happened
      this.cleanup();
    }
    this.backoff.reset();
    this.readyState = "closed";
    if (this.engine) this.engine.close();
  }

  disconnect() {
    debug("disconnect");
    this.skipReconnect = true;
    this.reconnecting = false;
    if ("opening" === this.readyState) {
      // `onclose` will not fire because
      // an open event never happened
      this.cleanup();
    }
    this.backoff.reset();
    this.readyState = "closed";
    if (this.engine) this.engine.close();
  }

  /**
   * Called upon engine close.
   *
   * @api private
   */
  onclose(reason) {
    debug("onclose");

    this.cleanup();
    this.backoff.reset();
    this.readyState = "closed";
    super.emit("close", reason);

    if (this._reconnection && !this.skipReconnect) {
      this.reconnect();
    }
  }

  /**
   * Attempt a reconnection.
   *
   * @api private
   */
  reconnect() {
    if (this.reconnecting || this.skipReconnect) return this;

    const self = this;

    if (this.backoff.attempts >= this._reconnectionAttempts) {
      debug("reconnect failed");
      this.backoff.reset();
      this.emitAll("reconnect_failed");
      this.reconnecting = false;
    } else {
      const delay = this.backoff.duration();
      debug("will wait %dms before reconnect attempt", delay);

      this.reconnecting = true;
      const timer = setTimeout(function () {
        if (self.skipReconnect) return;

        debug("attempting reconnect");
        self.emitAll("reconnect_attempt", self.backoff.attempts);
        self.emitAll("reconnecting", self.backoff.attempts);

        // check again for the case socket closed in above events
        if (self.skipReconnect) return;

        self.open(function (err) {
          if (err) {
            debug("reconnect attempt error");
            self.reconnecting = false;
            self.reconnect();
            self.emitAll("reconnect_error", err.data);
          } else {
            debug("reconnect success");
            self.onreconnect();
          }
        });
      }, delay);

      this.subs.push({
        destroy: function () {
          clearTimeout(timer);
        },
      });
    }
  }

  /**
   * Called upon successful reconnect.
   *
   * @api private
   */
  onreconnect() {
    const attempt = this.backoff.attempts;
    this.reconnecting = false;
    this.backoff.reset();
    this.updateSocketIds();
    this.emitAll("reconnect", attempt);
  }
}
