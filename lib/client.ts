import { Decoder, Encoder, Packet, PacketType } from "socket.io-parser";
import debugModule = require("debug");
import url = require("url");
import type { IncomingMessage } from "http";
import type { Server } from "./index";
import type { Namespace } from "./namespace";
import type { EventsMap } from "./typed-events";
import type { Socket } from "./socket";
import type { SocketId } from "socket.io-adapter";
import type { Socket as RawSocket } from "engine.io";

const debug = debugModule("socket.io:client");

interface WriteOptions {
  compress?: boolean;
  volatile?: boolean;
  preEncoded?: boolean;
  wsPreEncoded?: string;
}

type CloseReason =
  | "transport error"
  | "transport close"
  | "forced close"
  | "ping timeout"
  | "parse error";

export class Client<
  ListenEvents extends EventsMap,
  EmitEvents extends EventsMap,
  ServerSideEvents extends EventsMap,
  SocketData = any
> {
  public readonly conn: RawSocket;

  private readonly id: string;
  private readonly server: Server<
    ListenEvents,
    EmitEvents,
    ServerSideEvents,
    SocketData
  >;
  private readonly encoder: Encoder;
  private readonly decoder: Decoder;
  private sockets: Map<
    SocketId,
    Socket<ListenEvents, EmitEvents, ServerSideEvents, SocketData>
  > = new Map();
  private nsps: Map<
    string,
    Socket<ListenEvents, EmitEvents, ServerSideEvents, SocketData>
  > = new Map();
  private connectTimeout?: NodeJS.Timeout;

  /**
   * Client constructor.
   *
   * @param server instance
   * @param conn
   * @package
   */
  constructor(
    server: Server<ListenEvents, EmitEvents, ServerSideEvents, SocketData>,
    conn: any
  ) {
    this.server = server;
    this.conn = conn;
    this.encoder = server.encoder;
    this.decoder = new server._parser.Decoder();
    this.id = conn.id;
    this.setup();
  }

  /**
   * @return the reference to the request that originated the Engine.IO connection
   *
   * @public
   */
  public get request(): IncomingMessage {
    return this.conn.request;
  }

  /**
   * Sets up event listeners.
   *
   * @private
   */
  private setup() {
    this.onclose = this.onclose.bind(this);
    this.ondata = this.ondata.bind(this);
    this.onerror = this.onerror.bind(this);
    this.ondecoded = this.ondecoded.bind(this);

    // @ts-ignore
    this.decoder.on("decoded", this.ondecoded);
    this.conn.on("data", this.ondata);
    this.conn.on("error", this.onerror);
    this.conn.on("close", this.onclose);

    this.connectTimeout = setTimeout(() => {
      if (this.nsps.size === 0) {
        debug("no namespace joined yet, close the client");
        this.close();
      } else {
        debug("the client has already joined a namespace, nothing to do");
      }
    }, this.server._connectTimeout);
  }

  /**
   * Connects a client to a namespace.
   *
   * @param {String} name - the namespace
   * @param {Object} auth - the auth parameters
   * @private
   */
  private connect(name: string, auth: Record<string, unknown> = {}): void {
    if (this.server._nsps.has(name)) {
      debug("connecting to namespace %s", name);
      return this.doConnect(name, auth);
    }

    this.server._checkNamespace(
      name,
      auth,
      (
        dynamicNspName:
          | Namespace<ListenEvents, EmitEvents, ServerSideEvents, SocketData>
          | false
      ) => {
        if (dynamicNspName) {
          this.doConnect(name, auth);
        } else {
          debug("creation of namespace %s was denied", name);
          this._packet({
            type: PacketType.CONNECT_ERROR,
            nsp: name,
            data: {
              message: "Invalid namespace",
            },
          });
        }
      }
    );
  }

  /**
   * Connects a client to a namespace.
   *
   * @param name - the namespace
   * @param {Object} auth - the auth parameters
   *
   * @private
   */
  private doConnect(name: string, auth: Record<string, unknown>): void {
    const nsp = this.server.of(name);

    nsp._add(this, auth, (socket) => {
      this.sockets.set(socket.id, socket);
      this.nsps.set(nsp.name, socket);

      if (this.connectTimeout) {
        clearTimeout(this.connectTimeout);
        this.connectTimeout = undefined;
      }
    });
  }

  /**
   * Disconnects from all namespaces and closes transport.
   *
   * @private
   */
  _disconnect(): void {
    for (const socket of this.sockets.values()) {
      socket.disconnect();
    }
    this.sockets.clear();
    this.close();
  }

  /**
   * Removes a socket. Called by each `Socket`.
   *
   * @private
   */
  _remove(
    socket: Socket<ListenEvents, EmitEvents, ServerSideEvents, SocketData>
  ): void {
    if (this.sockets.has(socket.id)) {
      const nsp = this.sockets.get(socket.id)!.nsp.name;
      this.sockets.delete(socket.id);
      this.nsps.delete(nsp);
    } else {
      debug("ignoring remove for %s", socket.id);
    }
  }

  /**
   * Closes the underlying connection.
   *
   * @private
   */
  private close(): void {
    if ("open" === this.conn.readyState) {
      debug("forcing transport close");
      this.conn.close();
      this.onclose("forced server close");
    }
  }

  /**
   * Writes a packet to the transport.
   *
   * @param {Object} packet object
   * @param {Object} opts
   * @private
   */
  _packet(packet: Packet | any[], opts: WriteOptions = {}): void {
    if (this.conn.readyState !== "open") {
      debug("ignoring packet write %j", packet);
      return;
    }
    const encodedPackets = opts.preEncoded
      ? (packet as any[]) // previous versions of the adapter incorrectly used socket.packet() instead of writeToEngine()
      : this.encoder.encode(packet as Packet);
    this.writeToEngine(encodedPackets, opts);
  }

  private writeToEngine(
    encodedPackets: Array<string | Buffer>,
    opts: WriteOptions
  ): void {
    if (opts.volatile && !this.conn.transport.writable) {
      debug(
        "volatile packet is discarded since the transport is not currently writable"
      );
      return;
    }
    const packets = Array.isArray(encodedPackets)
      ? encodedPackets
      : [encodedPackets];
    for (const encodedPacket of packets) {
      this.conn.write(encodedPacket, opts);
    }
  }

  /**
   * Called with incoming transport data.
   *
   * @private
   */
  private ondata(data): void {
    // try/catch is needed for protocol violations (GH-1880)
    try {
      this.decoder.add(data);
    } catch (e) {
      debug("invalid packet format");
      this.onerror(e);
    }
  }

  /**
   * Called when parser fully decodes a packet.
   *
   * @private
   */
  private ondecoded(packet: Packet): void {
    let namespace: string;
    let authPayload: Record<string, unknown>;
    if (this.conn.protocol === 3) {
      const parsed = url.parse(packet.nsp, true);
      namespace = parsed.pathname!;
      authPayload = parsed.query;
    } else {
      namespace = packet.nsp;
      authPayload = packet.data;
    }
    const socket = this.nsps.get(namespace);

    if (!socket && packet.type === PacketType.CONNECT) {
      this.connect(namespace, authPayload);
    } else if (
      socket &&
      packet.type !== PacketType.CONNECT &&
      packet.type !== PacketType.CONNECT_ERROR
    ) {
      process.nextTick(function () {
        socket._onpacket(packet);
      });
    } else {
      debug("invalid state (packet type: %s)", packet.type);
      this.close();
    }
  }

  /**
   * Handles an error.
   *
   * @param {Object} err object
   * @private
   */
  private onerror(err): void {
    for (const socket of this.sockets.values()) {
      socket._onerror(err);
    }
    this.conn.close();
  }

  /**
   * Called upon transport close.
   *
   * @param reason
   * @param description
   * @private
   */
  private onclose(
    reason: CloseReason | "forced server close",
    description?: any
  ): void {
    debug("client close with reason %s", reason);

    // ignore a potential subsequent `close` event
    this.destroy();

    // `nsps` and `sockets` are cleaned up seamlessly
    for (const socket of this.sockets.values()) {
      socket._onclose(reason, description);
    }
    this.sockets.clear();

    this.decoder.destroy(); // clean up decoder
  }

  /**
   * Cleans up event listeners.
   * @private
   */
  private destroy(): void {
    this.conn.removeListener("data", this.ondata);
    this.conn.removeListener("error", this.onerror);
    this.conn.removeListener("close", this.onclose);
    // @ts-ignore
    this.decoder.removeListener("decoded", this.ondecoded);

    if (this.connectTimeout) {
      clearTimeout(this.connectTimeout);
      this.connectTimeout = undefined;
    }
  }
}
