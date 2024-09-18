import { EventEmitter } from "events";
import debugModule from "debug";
import type { IncomingMessage } from "http";
import type { EngineRequest, Transport } from "./transport";
import type { BaseServer } from "./server";
import { setTimeout, clearTimeout } from "timers";
import type { Packet, PacketType, RawData } from "engine.io-parser";

const debug = debugModule("engine:socket");

export interface SendOptions {
  compress?: boolean;
}

type ReadyState = "opening" | "open" | "closing" | "closed";

type SendCallback = (transport: Transport) => void;

export class Socket extends EventEmitter {
  /**
   * The revision of the protocol:
   *
   * - 3rd is used in Engine.IO v3 / Socket.IO v2
   * - 4th is used in Engine.IO v4 and above / Socket.IO v3 and above
   *
   * It is found in the `EIO` query parameters of the HTTP requests.
   *
   * @see https://github.com/socketio/engine.io-protocol
   */
  public readonly protocol: number;
  /**
   * A reference to the first HTTP request of the session
   *
   * TODO for the next major release: remove it
   */
  public request: IncomingMessage;
  /**
   * The IP address of the client.
   */
  public readonly remoteAddress: string;

  /**
   * The current state of the socket.
   */
  public _readyState: ReadyState = "opening";
  /**
   * The current low-level transport.
   */
  public transport: Transport;

  private server: BaseServer;
  /* private */ upgrading = false;
  /* private */ upgraded = false;
  private writeBuffer: Packet[] = [];
  private packetsFn: SendCallback[] = [];
  private sentCallbackFn: SendCallback[][] = [];
  private cleanupFn: any[] = [];
  private pingTimeoutTimer;
  private pingIntervalTimer;

  /**
   * This is the session identifier that the client will use in the subsequent HTTP requests. It must not be shared with
   * others parties, as it might lead to session hijacking.
   *
   * @private
   */
  private readonly id: string;

  get readyState() {
    return this._readyState;
  }

  set readyState(state: ReadyState) {
    debug("readyState updated from %s to %s", this._readyState, state);
    this._readyState = state;
  }

  constructor(
    id: string,
    server: BaseServer,
    transport: Transport,
    req: EngineRequest,
    protocol: number,
  ) {
    super();
    this.id = id;
    this.server = server;
    this.request = req;
    this.protocol = protocol;

    // Cache IP since it might not be in the req later
    if (req) {
      if (req.websocket && req.websocket._socket) {
        this.remoteAddress = req.websocket._socket.remoteAddress;
      } else {
        this.remoteAddress = req.connection.remoteAddress;
      }
    } else {
      // TODO there is currently no way to get the IP address of the client when it connects with WebTransport
      //  see https://github.com/fails-components/webtransport/issues/114
    }

    this.pingTimeoutTimer = null;
    this.pingIntervalTimer = null;

    this.setTransport(transport);
    this.onOpen();
  }

  /**
   * Called upon transport considered open.
   *
   * @private
   */
  private onOpen() {
    this.readyState = "open";

    // sends an `open` packet
    this.transport.sid = this.id;
    this.sendPacket(
      "open",
      JSON.stringify({
        sid: this.id,
        upgrades: this.getAvailableUpgrades(),
        pingInterval: this.server.opts.pingInterval,
        pingTimeout: this.server.opts.pingTimeout,
        maxPayload: this.server.opts.maxHttpBufferSize,
      }),
    );

    if (this.server.opts.initialPacket) {
      this.sendPacket("message", this.server.opts.initialPacket);
    }

    this.emit("open");

    if (this.protocol === 3) {
      // in protocol v3, the client sends a ping, and the server answers with a pong
      this.resetPingTimeout();
    } else {
      // in protocol v4, the server sends a ping, and the client answers with a pong
      this.schedulePing();
    }
  }

  /**
   * Called upon transport packet.
   *
   * @param {Object} packet
   * @private
   */
  private onPacket(packet: Packet) {
    if ("open" !== this.readyState) {
      return debug("packet received with closed socket");
    }
    // export packet event
    debug(`received packet ${packet.type}`);
    this.emit("packet", packet);

    switch (packet.type) {
      case "ping":
        if (this.transport.protocol !== 3) {
          this.onError(new Error("invalid heartbeat direction"));
          return;
        }
        debug("got ping");
        this.pingTimeoutTimer.refresh();
        this.sendPacket("pong");
        this.emit("heartbeat");
        break;

      case "pong":
        if (this.transport.protocol === 3) {
          this.onError(new Error("invalid heartbeat direction"));
          return;
        }
        debug("got pong");
        clearTimeout(this.pingTimeoutTimer);
        this.pingIntervalTimer.refresh();
        this.emit("heartbeat");
        break;

      case "error":
        this.onClose("parse error");
        break;

      case "message":
        this.emit("data", packet.data);
        this.emit("message", packet.data);
        break;
    }
  }

  /**
   * Called upon transport error.
   *
   * @param {Error} err - error object
   * @private
   */
  private onError(err: Error) {
    debug("transport error");
    this.onClose("transport error", err);
  }

  /**
   * Pings client every `this.pingInterval` and expects response
   * within `this.pingTimeout` or closes connection.
   *
   * @private
   */
  private schedulePing() {
    this.pingIntervalTimer = setTimeout(() => {
      debug(
        "writing ping packet - expecting pong within %sms",
        this.server.opts.pingTimeout,
      );
      this.sendPacket("ping");
      this.resetPingTimeout();
    }, this.server.opts.pingInterval);
  }

  /**
   * Resets ping timeout.
   *
   * @private
   */
  private resetPingTimeout() {
    clearTimeout(this.pingTimeoutTimer);
    this.pingTimeoutTimer = setTimeout(
      () => {
        if (this.readyState === "closed") return;
        this.onClose("ping timeout");
      },
      this.protocol === 3
        ? this.server.opts.pingInterval + this.server.opts.pingTimeout
        : this.server.opts.pingTimeout,
    );
  }

  /**
   * Attaches handlers for the given transport.
   *
   * @param {Transport} transport
   * @private
   */
  private setTransport(transport: Transport) {
    const onError = this.onError.bind(this);
    const onReady = () => this.flush();
    const onPacket = this.onPacket.bind(this);
    const onDrain = this.onDrain.bind(this);
    const onClose = this.onClose.bind(this, "transport close");

    this.transport = transport;
    this.transport.once("error", onError);
    this.transport.on("ready", onReady);
    this.transport.on("packet", onPacket);
    this.transport.on("drain", onDrain);
    this.transport.once("close", onClose);

    this.cleanupFn.push(function () {
      transport.removeListener("error", onError);
      transport.removeListener("ready", onReady);
      transport.removeListener("packet", onPacket);
      transport.removeListener("drain", onDrain);
      transport.removeListener("close", onClose);
    });
  }

  /**
   * Upon transport "drain" event
   *
   * @private
   */
  private onDrain() {
    if (this.sentCallbackFn.length > 0) {
      debug("executing batch send callback");
      const seqFn = this.sentCallbackFn.shift();
      if (seqFn) {
        for (let i = 0; i < seqFn.length; i++) {
          seqFn[i](this.transport);
        }
      }
    }
  }

  /**
   * Upgrades socket to the given transport
   *
   * @param {Transport} transport
   * @private
   */
  /* private */ _maybeUpgrade(transport: Transport) {
    debug(
      'might upgrade socket transport from "%s" to "%s"',
      this.transport.name,
      transport.name,
    );

    this.upgrading = true;

    // set transport upgrade timer
    const upgradeTimeoutTimer = setTimeout(() => {
      debug("client did not complete upgrade - closing transport");
      cleanup();
      if ("open" === transport.readyState) {
        transport.close();
      }
    }, this.server.opts.upgradeTimeout);

    let checkIntervalTimer;

    const onPacket = (packet) => {
      if ("ping" === packet.type && "probe" === packet.data) {
        debug("got probe ping packet, sending pong");
        transport.send([{ type: "pong", data: "probe" }]);
        this.emit("upgrading", transport);
        clearInterval(checkIntervalTimer);
        checkIntervalTimer = setInterval(check, 100);
      } else if ("upgrade" === packet.type && this.readyState !== "closed") {
        debug("got upgrade packet - upgrading");
        cleanup();
        this.transport.discard();
        this.upgraded = true;
        this.clearTransport();
        this.setTransport(transport);
        this.emit("upgrade", transport);
        this.flush();
        if (this.readyState === "closing") {
          transport.close(() => {
            this.onClose("forced close");
          });
        }
      } else {
        cleanup();
        transport.close();
      }
    };

    // we force a polling cycle to ensure a fast upgrade
    const check = () => {
      if ("polling" === this.transport.name && this.transport.writable) {
        debug("writing a noop packet to polling for fast upgrade");
        this.transport.send([{ type: "noop" }]);
      }
    };

    const cleanup = () => {
      this.upgrading = false;

      clearInterval(checkIntervalTimer);
      clearTimeout(upgradeTimeoutTimer);

      transport.removeListener("packet", onPacket);
      transport.removeListener("close", onTransportClose);
      transport.removeListener("error", onError);
      this.removeListener("close", onClose);
    };

    const onError = (err) => {
      debug("client did not complete upgrade - %s", err);
      cleanup();
      transport.close();
      transport = null;
    };

    const onTransportClose = () => {
      onError("transport closed");
    };

    const onClose = () => {
      onError("socket closed");
    };

    transport.on("packet", onPacket);
    transport.once("close", onTransportClose);
    transport.once("error", onError);

    this.once("close", onClose);
  }

  /**
   * Clears listeners and timers associated with current transport.
   *
   * @private
   */
  private clearTransport() {
    let cleanup;

    const toCleanUp = this.cleanupFn.length;

    for (let i = 0; i < toCleanUp; i++) {
      cleanup = this.cleanupFn.shift();
      cleanup();
    }

    // silence further transport errors and prevent uncaught exceptions
    this.transport.on("error", function () {
      debug("error triggered by discarded transport");
    });

    // ensure transport won't stay open
    this.transport.close();

    clearTimeout(this.pingTimeoutTimer);
  }

  /**
   * Called upon transport considered closed.
   * Possible reasons: `ping timeout`, `client error`, `parse error`,
   * `transport error`, `server close`, `transport close`
   */
  private onClose(reason: string, description?) {
    if ("closed" !== this.readyState) {
      this.readyState = "closed";

      // clear timers
      clearTimeout(this.pingIntervalTimer);
      clearTimeout(this.pingTimeoutTimer);

      // clean writeBuffer in next tick, so developers can still
      // grab the writeBuffer on 'close' event
      process.nextTick(() => {
        this.writeBuffer = [];
      });
      this.packetsFn = [];
      this.sentCallbackFn = [];
      this.clearTransport();
      this.emit("close", reason, description);
    }
  }

  /**
   * Sends a message packet.
   *
   * @param {Object} data
   * @param {Object} options
   * @param {Function} callback
   * @return {Socket} for chaining
   */
  public send(data: RawData, options?: SendOptions, callback?: SendCallback) {
    this.sendPacket("message", data, options, callback);
    return this;
  }

  /**
   * Alias of {@link send}.
   *
   * @param data
   * @param options
   * @param callback
   */
  public write(data: RawData, options?: SendOptions, callback?: SendCallback) {
    this.sendPacket("message", data, options, callback);
    return this;
  }

  /**
   * Sends a packet.
   *
   * @param {String} type - packet type
   * @param {String} data
   * @param {Object} options
   * @param {Function} callback
   *
   * @private
   */
  private sendPacket(
    type: PacketType,
    data?: RawData,
    options: SendOptions = {},
    callback?: SendCallback,
  ) {
    if ("function" === typeof options) {
      callback = options;
      options = {};
    }

    if ("closing" !== this.readyState && "closed" !== this.readyState) {
      debug('sending packet "%s" (%s)', type, data);

      // compression is enabled by default
      options.compress = options.compress !== false;

      const packet: Packet = {
        type,
        options: options as { compress: boolean },
      };

      if (data) packet.data = data;

      // exports packetCreate event
      this.emit("packetCreate", packet);

      this.writeBuffer.push(packet);

      // add send callback to object, if defined
      if ("function" === typeof callback) this.packetsFn.push(callback);

      this.flush();
    }
  }

  /**
   * Attempts to flush the packets buffer.
   *
   * @private
   */
  private flush() {
    if (
      "closed" !== this.readyState &&
      this.transport.writable &&
      this.writeBuffer.length
    ) {
      debug("flushing buffer to transport");
      this.emit("flush", this.writeBuffer);
      this.server.emit("flush", this, this.writeBuffer);
      const wbuf = this.writeBuffer;
      this.writeBuffer = [];

      if (this.packetsFn.length) {
        this.sentCallbackFn.push(this.packetsFn);
        this.packetsFn = [];
      } else {
        this.sentCallbackFn.push(null);
      }

      this.transport.send(wbuf);
      this.emit("drain");
      this.server.emit("drain", this);
    }
  }

  /**
   * Get available upgrades for this socket.
   *
   * @private
   */
  private getAvailableUpgrades() {
    const availableUpgrades = [];
    const allUpgrades = this.server.upgrades(this.transport.name);
    for (let i = 0; i < allUpgrades.length; ++i) {
      const upg = allUpgrades[i];
      if (this.server.opts.transports.indexOf(upg) !== -1) {
        availableUpgrades.push(upg);
      }
    }
    return availableUpgrades;
  }

  /**
   * Closes the socket and underlying transport.
   *
   * @param {Boolean} discard - optional, discard the transport
   * @return {Socket} for chaining
   */
  public close(discard?: boolean) {
    if (
      discard &&
      (this.readyState === "open" || this.readyState === "closing")
    ) {
      return this.closeTransport(discard);
    }

    if ("open" !== this.readyState) return;

    this.readyState = "closing";

    if (this.writeBuffer.length) {
      debug(
        "there are %d remaining packets in the buffer, waiting for the 'drain' event",
        this.writeBuffer.length,
      );
      this.once("drain", () => {
        debug("all packets have been sent, closing the transport");
        this.closeTransport(discard);
      });
      return;
    }

    debug("the buffer is empty, closing the transport right away");
    this.closeTransport(discard);
  }

  /**
   * Closes the underlying transport.
   *
   * @param {Boolean} discard
   * @private
   */
  private closeTransport(discard: boolean) {
    debug("closing the transport (discard? %s)", !!discard);
    if (discard) this.transport.discard();
    this.transport.close(this.onClose.bind(this, "forced close"));
  }
}
