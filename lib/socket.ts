import { transports } from "./transports/index.js";
import { installTimerFunctions, byteLength } from "./util.js";
import { decode } from "./contrib/parseqs.js";
import { parse } from "./contrib/parseuri.js";
import debugModule from "debug"; // debug()
import { Emitter } from "@socket.io/component-emitter";
import { protocol } from "engine.io-parser";
import type { Packet, BinaryType, PacketType, RawData } from "engine.io-parser";
import { CloseDetails, Transport } from "./transport.js";
import { defaultBinaryType } from "./transports/websocket-constructor.js";

const debug = debugModule("engine.io-client:socket"); // debug()

export interface SocketOptions {
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
  port: string | number;

  /**
   * Any query parameters in our uri. Set from the URI passed when connecting
   */
  query: { [key: string]: any };

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
   * Forces base 64 encoding for polling transport even when XHR2
   * responseType is available and WebSocket even if the used standard
   * supports binary.
   */
  forceBase64: boolean;

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
   *
   * @default ['polling','websocket', 'webtransport']
   */
  transports: string[];

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
   * Timeout for xhr-polling requests in milliseconds (0) (only for polling transport)
   */
  requestTimeout: number;

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

  /**
   * Whether to automatically close the connection whenever the beforeunload event is received.
   * @default false
   */
  closeOnBeforeunload: boolean;

  /**
   * Whether to always use the native timeouts. This allows the client to
   * reconnect when the native timeout functions are overridden, such as when
   * mock clocks are installed.
   * @default false
   */
  useNativeTimers: boolean;

  /**
   * weather we should unref the reconnect timer when it is
   * create automatically
   * @default false
   */
  autoUnref: boolean;

  /**
   * parameters of the WebSocket permessage-deflate extension (see ws module api docs). Set to false to disable.
   * @default false
   */
  perMessageDeflate: { threshold: number };

  /**
   * The path to get our client file from, in the case of the server
   * serving it
   * @default '/engine.io'
   */
  path: string;

  /**
   * Whether we should add a trailing slash to the request path.
   * @default true
   */
  addTrailingSlash: boolean;

  /**
   * Either a single protocol string or an array of protocol strings. These strings are used to indicate sub-protocols,
   * so that a single server can implement multiple WebSocket sub-protocols (for example, you might want one server to
   * be able to handle different types of interactions depending on the specified protocol)
   * @default []
   */
  protocols: string | string[];
}

interface HandshakeData {
  sid: string;
  upgrades: string[];
  pingInterval: number;
  pingTimeout: number;
  maxPayload: number;
}

interface SocketReservedEvents {
  open: () => void;
  handshake: (data: HandshakeData) => void;
  packet: (packet: Packet) => void;
  packetCreate: (packet: Packet) => void;
  data: (data) => void;
  message: (data) => void;
  drain: () => void;
  flush: () => void;
  heartbeat: () => void;
  ping: () => void;
  pong: () => void;
  error: (err: string | Error) => void;
  upgrading: (transport) => void;
  upgrade: (transport) => void;
  upgradeError: (err: Error) => void;
  close: (reason: string, description?: CloseDetails | Error) => void;
}

type SocketState = "opening" | "open" | "closing" | "closed";

export class Socket extends Emitter<
  Record<never, never>,
  Record<never, never>,
  SocketReservedEvents
> {
  public id: string;
  public transport: Transport;
  public binaryType: BinaryType = defaultBinaryType;
  public readyState: SocketState;
  public writeBuffer: Packet[] = [];

  private prevBufferLen: number;
  private upgrades: string[];
  private pingInterval: number;
  private pingTimeout: number;
  private pingTimeoutTimer: NodeJS.Timer;
  private setTimeoutFn: typeof setTimeout;
  private clearTimeoutFn: typeof clearTimeout;
  private readonly beforeunloadEventListener: () => void;
  private readonly offlineEventListener: () => void;
  private upgrading: boolean;
  private maxPayload?: number;

  private readonly opts: Partial<SocketOptions>;
  private readonly secure: boolean;
  private readonly hostname: string;
  private readonly port: string | number;
  private readonly transports: string[];

  static priorWebsocketSuccess: boolean;
  static protocol = protocol;

  /**
   * Socket constructor.
   *
   * @param {String|Object} uri - uri or options
   * @param {Object} opts - options
   */
  constructor(uri, opts: Partial<SocketOptions> = {}) {
    super();

    if (uri && "object" === typeof uri) {
      opts = uri;
      uri = null;
    }

    if (uri) {
      uri = parse(uri);
      opts.hostname = uri.host;
      opts.secure = uri.protocol === "https" || uri.protocol === "wss";
      opts.port = uri.port;
      if (uri.query) opts.query = uri.query;
    } else if (opts.host) {
      opts.hostname = parse(opts.host).host;
    }

    installTimerFunctions(this, opts);

    this.secure =
      null != opts.secure
        ? opts.secure
        : typeof location !== "undefined" && "https:" === location.protocol;

    if (opts.hostname && !opts.port) {
      // if no port is specified manually, use the protocol default
      opts.port = this.secure ? "443" : "80";
    }

    this.hostname =
      opts.hostname ||
      (typeof location !== "undefined" ? location.hostname : "localhost");
    this.port =
      opts.port ||
      (typeof location !== "undefined" && location.port
        ? location.port
        : this.secure
        ? "443"
        : "80");

    this.transports = opts.transports || [
      "polling",
      "websocket",
      "webtransport",
    ];
    this.writeBuffer = [];
    this.prevBufferLen = 0;

    this.opts = Object.assign(
      {
        path: "/engine.io",
        agent: false,
        withCredentials: false,
        upgrade: true,
        timestampParam: "t",
        rememberUpgrade: false,
        addTrailingSlash: true,
        rejectUnauthorized: true,
        perMessageDeflate: {
          threshold: 1024,
        },
        transportOptions: {},
        closeOnBeforeunload: false,
      },
      opts
    );

    this.opts.path =
      this.opts.path.replace(/\/$/, "") +
      (this.opts.addTrailingSlash ? "/" : "");

    if (typeof this.opts.query === "string") {
      this.opts.query = decode(this.opts.query);
    }

    // set on handshake
    this.id = null;
    this.upgrades = null;
    this.pingInterval = null;
    this.pingTimeout = null;

    // set on heartbeat
    this.pingTimeoutTimer = null;

    if (typeof addEventListener === "function") {
      if (this.opts.closeOnBeforeunload) {
        // Firefox closes the connection when the "beforeunload" event is emitted but not Chrome. This event listener
        // ensures every browser behaves the same (no "disconnect" event at the Socket.IO level when the page is
        // closed/reloaded)
        this.beforeunloadEventListener = () => {
          if (this.transport) {
            // silently close the transport
            this.transport.removeAllListeners();
            this.transport.close();
          }
        };
        addEventListener("beforeunload", this.beforeunloadEventListener, false);
      }
      if (this.hostname !== "localhost") {
        this.offlineEventListener = () => {
          this.onClose("transport close", {
            description: "network connection lost",
          });
        };
        addEventListener("offline", this.offlineEventListener, false);
      }
    }

    this.open();
  }

  /**
   * Creates transport of the given type.
   *
   * @param {String} name - transport name
   * @return {Transport}
   * @private
   */
  private createTransport(name) {
    debug('creating transport "%s"', name);
    const query: any = Object.assign({}, this.opts.query);

    // append engine.io protocol identifier
    query.EIO = protocol;

    // transport name
    query.transport = name;

    // session id if we already have one
    if (this.id) query.sid = this.id;

    const opts = Object.assign(
      {},
      this.opts,
      {
        query,
        socket: this,
        hostname: this.hostname,
        secure: this.secure,
        port: this.port,
      },
      this.opts.transportOptions[name]
    );

    debug("options: %j", opts);

    return new transports[name](opts);
  }

  /**
   * Initializes transport to use and starts probe.
   *
   * @private
   */
  private open() {
    let transport;
    if (
      this.opts.rememberUpgrade &&
      Socket.priorWebsocketSuccess &&
      this.transports.indexOf("websocket") !== -1
    ) {
      transport = "websocket";
    } else if (0 === this.transports.length) {
      // Emit error on next tick so it can be listened to
      this.setTimeoutFn(() => {
        this.emitReserved("error", "No transports available");
      }, 0);
      return;
    } else {
      transport = this.transports[0];
    }
    this.readyState = "opening";

    // Retry with the next transport if the transport is disabled (jsonp: false)
    try {
      transport = this.createTransport(transport);
    } catch (e) {
      debug("error while creating transport: %s", e);
      this.transports.shift();
      this.open();
      return;
    }

    transport.open();
    this.setTransport(transport);
  }

  /**
   * Sets the current transport. Disables the existing one (if any).
   *
   * @private
   */
  private setTransport(transport) {
    debug("setting transport %s", transport.name);

    if (this.transport) {
      debug("clearing existing transport %s", this.transport.name);
      this.transport.removeAllListeners();
    }

    // set up transport
    this.transport = transport;

    // set up transport listeners
    transport
      .on("drain", this.onDrain.bind(this))
      .on("packet", this.onPacket.bind(this))
      .on("error", this.onError.bind(this))
      .on("close", (reason) => this.onClose("transport close", reason));
  }

  /**
   * Probes a transport.
   *
   * @param {String} name - transport name
   * @private
   */
  private probe(name) {
    debug('probing transport "%s"', name);
    let transport = this.createTransport(name);
    let failed = false;

    Socket.priorWebsocketSuccess = false;

    const onTransportOpen = () => {
      if (failed) return;

      debug('probe transport "%s" opened', name);
      transport.send([{ type: "ping", data: "probe" }]);
      transport.once("packet", (msg) => {
        if (failed) return;
        if ("pong" === msg.type && "probe" === msg.data) {
          debug('probe transport "%s" pong', name);
          this.upgrading = true;
          this.emitReserved("upgrading", transport);
          if (!transport) return;
          Socket.priorWebsocketSuccess = "websocket" === transport.name;

          debug('pausing current transport "%s"', this.transport.name);
          this.transport.pause(() => {
            if (failed) return;
            if ("closed" === this.readyState) return;
            debug("changing transport and sending upgrade packet");

            cleanup();

            this.setTransport(transport);
            transport.send([{ type: "upgrade" }]);
            this.emitReserved("upgrade", transport);
            transport = null;
            this.upgrading = false;
            this.flush();
          });
        } else {
          debug('probe transport "%s" failed', name);
          const err = new Error("probe error");
          // @ts-ignore
          err.transport = transport.name;
          this.emitReserved("upgradeError", err);
        }
      });
    };

    function freezeTransport() {
      if (failed) return;

      // Any callback called by transport should be ignored since now
      failed = true;

      cleanup();

      transport.close();
      transport = null;
    }

    // Handle any error that happens while probing
    const onerror = (err) => {
      const error = new Error("probe error: " + err);
      // @ts-ignore
      error.transport = transport.name;

      freezeTransport();

      debug('probe transport "%s" failed because of error: %s', name, err);

      this.emitReserved("upgradeError", error);
    };

    function onTransportClose() {
      onerror("transport closed");
    }

    // When the socket is closed while we're probing
    function onclose() {
      onerror("socket closed");
    }

    // When the socket is upgraded while we're probing
    function onupgrade(to) {
      if (transport && to.name !== transport.name) {
        debug('"%s" works - aborting "%s"', to.name, transport.name);
        freezeTransport();
      }
    }

    // Remove all listeners on the transport and on self
    const cleanup = () => {
      transport.removeListener("open", onTransportOpen);
      transport.removeListener("error", onerror);
      transport.removeListener("close", onTransportClose);
      this.off("close", onclose);
      this.off("upgrading", onupgrade);
    };

    transport.once("open", onTransportOpen);
    transport.once("error", onerror);
    transport.once("close", onTransportClose);

    this.once("close", onclose);
    this.once("upgrading", onupgrade);

    if (
      this.upgrades.indexOf("webtransport") !== -1 &&
      name !== "webtransport"
    ) {
      // favor WebTransport
      this.setTimeoutFn(() => {
        if (!failed) {
          transport.open();
        }
      }, 200);
    } else {
      transport.open();
    }
  }

  /**
   * Called when connection is deemed open.
   *
   * @private
   */
  private onOpen() {
    debug("socket open");
    this.readyState = "open";
    Socket.priorWebsocketSuccess = "websocket" === this.transport.name;
    this.emitReserved("open");
    this.flush();

    // we check for `readyState` in case an `open`
    // listener already closed the socket
    if ("open" === this.readyState && this.opts.upgrade) {
      debug("starting upgrade probes");
      let i = 0;
      const l = this.upgrades.length;
      for (; i < l; i++) {
        this.probe(this.upgrades[i]);
      }
    }
  }

  /**
   * Handles a packet.
   *
   * @private
   */
  private onPacket(packet) {
    if (
      "opening" === this.readyState ||
      "open" === this.readyState ||
      "closing" === this.readyState
    ) {
      debug('socket receive: type "%s", data "%s"', packet.type, packet.data);

      this.emitReserved("packet", packet);

      // Socket is live - any packet counts
      this.emitReserved("heartbeat");

      switch (packet.type) {
        case "open":
          this.onHandshake(JSON.parse(packet.data));
          break;

        case "ping":
          this.resetPingTimeout();
          this.sendPacket("pong");
          this.emitReserved("ping");
          this.emitReserved("pong");
          break;

        case "error":
          const err = new Error("server error");
          // @ts-ignore
          err.code = packet.data;
          this.onError(err);
          break;

        case "message":
          this.emitReserved("data", packet.data);
          this.emitReserved("message", packet.data);
          break;
      }
    } else {
      debug('packet received with socket readyState "%s"', this.readyState);
    }
  }

  /**
   * Called upon handshake completion.
   *
   * @param {Object} data - handshake obj
   * @private
   */
  private onHandshake(data: HandshakeData) {
    this.emitReserved("handshake", data);
    this.id = data.sid;
    this.transport.query.sid = data.sid;
    this.upgrades = this.filterUpgrades(data.upgrades);
    this.pingInterval = data.pingInterval;
    this.pingTimeout = data.pingTimeout;
    this.maxPayload = data.maxPayload;
    this.onOpen();
    // In case open handler closes socket
    if ("closed" === this.readyState) return;
    this.resetPingTimeout();
  }

  /**
   * Sets and resets ping timeout timer based on server pings.
   *
   * @private
   */
  private resetPingTimeout() {
    this.clearTimeoutFn(this.pingTimeoutTimer);
    this.pingTimeoutTimer = this.setTimeoutFn(() => {
      this.onClose("ping timeout");
    }, this.pingInterval + this.pingTimeout);
    if (this.opts.autoUnref) {
      this.pingTimeoutTimer.unref();
    }
  }

  /**
   * Called on `drain` event
   *
   * @private
   */
  private onDrain() {
    this.writeBuffer.splice(0, this.prevBufferLen);

    // setting prevBufferLen = 0 is very important
    // for example, when upgrading, upgrade packet is sent over,
    // and a nonzero prevBufferLen could cause problems on `drain`
    this.prevBufferLen = 0;

    if (0 === this.writeBuffer.length) {
      this.emitReserved("drain");
    } else {
      this.flush();
    }
  }

  /**
   * Flush write buffers.
   *
   * @private
   */
  private flush() {
    if (
      "closed" !== this.readyState &&
      this.transport.writable &&
      !this.upgrading &&
      this.writeBuffer.length
    ) {
      const packets = this.getWritablePackets();
      debug("flushing %d packets in socket", packets.length);
      this.transport.send(packets);
      // keep track of current length of writeBuffer
      // splice writeBuffer and callbackBuffer on `drain`
      this.prevBufferLen = packets.length;
      this.emitReserved("flush");
    }
  }

  /**
   * Ensure the encoded size of the writeBuffer is below the maxPayload value sent by the server (only for HTTP
   * long-polling)
   *
   * @private
   */
  private getWritablePackets() {
    const shouldCheckPayloadSize =
      this.maxPayload &&
      this.transport.name === "polling" &&
      this.writeBuffer.length > 1;
    if (!shouldCheckPayloadSize) {
      return this.writeBuffer;
    }
    let payloadSize = 1; // first packet type
    for (let i = 0; i < this.writeBuffer.length; i++) {
      const data = this.writeBuffer[i].data;
      if (data) {
        payloadSize += byteLength(data);
      }
      if (i > 0 && payloadSize > this.maxPayload) {
        debug("only send %d out of %d packets", i, this.writeBuffer.length);
        return this.writeBuffer.slice(0, i);
      }
      payloadSize += 2; // separator + packet type
    }
    debug("payload size is %d (max: %d)", payloadSize, this.maxPayload);
    return this.writeBuffer;
  }

  /**
   * Sends a message.
   *
   * @param {String} msg - message.
   * @param {Object} options.
   * @param {Function} callback function.
   * @return {Socket} for chaining.
   */
  public write(msg: RawData, options?, fn?) {
    this.sendPacket("message", msg, options, fn);
    return this;
  }

  public send(msg: RawData, options?, fn?) {
    this.sendPacket("message", msg, options, fn);
    return this;
  }

  /**
   * Sends a packet.
   *
   * @param {String} type: packet type.
   * @param {String} data.
   * @param {Object} options.
   * @param {Function} fn - callback function.
   * @private
   */
  private sendPacket(type: PacketType, data?: RawData, options?, fn?) {
    if ("function" === typeof data) {
      fn = data;
      data = undefined;
    }

    if ("function" === typeof options) {
      fn = options;
      options = null;
    }

    if ("closing" === this.readyState || "closed" === this.readyState) {
      return;
    }

    options = options || {};
    options.compress = false !== options.compress;

    const packet = {
      type: type,
      data: data,
      options: options,
    };
    this.emitReserved("packetCreate", packet);
    this.writeBuffer.push(packet);
    if (fn) this.once("flush", fn);
    this.flush();
  }

  /**
   * Closes the connection.
   */
  public close() {
    const close = () => {
      this.onClose("forced close");
      debug("socket closing - telling transport to close");
      this.transport.close();
    };

    const cleanupAndClose = () => {
      this.off("upgrade", cleanupAndClose);
      this.off("upgradeError", cleanupAndClose);
      close();
    };

    const waitForUpgrade = () => {
      // wait for upgrade to finish since we can't send packets while pausing a transport
      this.once("upgrade", cleanupAndClose);
      this.once("upgradeError", cleanupAndClose);
    };

    if ("opening" === this.readyState || "open" === this.readyState) {
      this.readyState = "closing";

      if (this.writeBuffer.length) {
        this.once("drain", () => {
          if (this.upgrading) {
            waitForUpgrade();
          } else {
            close();
          }
        });
      } else if (this.upgrading) {
        waitForUpgrade();
      } else {
        close();
      }
    }

    return this;
  }

  /**
   * Called upon transport error
   *
   * @private
   */
  private onError(err) {
    debug("socket error %j", err);
    Socket.priorWebsocketSuccess = false;
    this.emitReserved("error", err);
    this.onClose("transport error", err);
  }

  /**
   * Called upon transport close.
   *
   * @private
   */
  private onClose(reason: string, description?: CloseDetails | Error) {
    if (
      "opening" === this.readyState ||
      "open" === this.readyState ||
      "closing" === this.readyState
    ) {
      debug('socket close with reason: "%s"', reason);

      // clear timers
      this.clearTimeoutFn(this.pingTimeoutTimer);

      // stop event from firing again for transport
      this.transport.removeAllListeners("close");

      // ensure transport won't stay open
      this.transport.close();

      // ignore further transport communication
      this.transport.removeAllListeners();

      if (typeof removeEventListener === "function") {
        removeEventListener(
          "beforeunload",
          this.beforeunloadEventListener,
          false
        );
        removeEventListener("offline", this.offlineEventListener, false);
      }

      // set ready state
      this.readyState = "closed";

      // clear session id
      this.id = null;

      // emit close event
      this.emitReserved("close", reason, description);

      // clean buffers after, so users can still
      // grab the buffers on `close` event
      this.writeBuffer = [];
      this.prevBufferLen = 0;
    }
  }

  /**
   * Filters upgrades, returning only those matching client transports.
   *
   * @param {Array} upgrades - server upgrades
   * @private
   */
  private filterUpgrades(upgrades) {
    const filteredUpgrades = [];
    let i = 0;
    const j = upgrades.length;
    for (; i < j; i++) {
      if (~this.transports.indexOf(upgrades[i]))
        filteredUpgrades.push(upgrades[i]);
    }
    return filteredUpgrades;
  }
}
