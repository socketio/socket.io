import { Decoder, Encoder, Packet, PacketType } from "socket.io-parser";
import debugModule = require("debug");
import { IncomingMessage } from "http";
import { Server } from "./index";
import { Socket } from "./socket";
import { SocketId } from "socket.io-adapter";
import { ParentNamespace } from "./parent-namespace";

const debug = debugModule("socket.io:client");

export class Client {
  public readonly conn;

  private readonly id: string;
  private readonly server: Server;
  private readonly encoder: Encoder;
  private readonly decoder: Decoder;
  private sockets: Map<SocketId, Socket> = new Map();
  private nsps: Map<string, Socket> = new Map();
  private connectTimeout: NodeJS.Timeout;

  /**
   * Client constructor.
   *
   * @param {Server} server instance
   * @param {Socket} conn
   * @package
   */
  constructor(server: Server, conn) {
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
  private connect(name: string, auth: object = {}) {
    if (this.server._nsps.has(name)) {
      debug("connecting to namespace %s", name);
      return this.doConnect(name, auth);
    }

    this.server._checkNamespace(name, auth, (dynamicNsp: ParentNamespace) => {
      if (dynamicNsp) {
        debug("dynamic namespace %s was created", dynamicNsp.name);
        this.doConnect(name, auth);
      } else {
        debug("creation of namespace %s was denied", name);
        this._packet({
          type: PacketType.CONNECT_ERROR,
          nsp: name,
          data: {
            message: "Invalid namespace"
          }
        });
      }
    });
  }

  /**
   * Connects a client to a namespace.
   *
   * @param {String} name - the namespace
   * @param {Object} auth - the auth parameters
   *
   * @private
   */
  private doConnect(name: string, auth: object) {
    if (this.connectTimeout) {
      clearTimeout(this.connectTimeout);
      this.connectTimeout = null;
    }
    const nsp = this.server.of(name);

    const socket = nsp._add(this, auth, () => {
      this.sockets.set(socket.id, socket);
      this.nsps.set(nsp.name, socket);
    });
  }

  /**
   * Disconnects from all namespaces and closes transport.
   *
   * @private
   */
  _disconnect() {
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
  _remove(socket: Socket) {
    if (this.sockets.has(socket.id)) {
      const nsp = this.sockets.get(socket.id).nsp.name;
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
  private close() {
    if ("open" == this.conn.readyState) {
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
  _packet(packet, opts?) {
    opts = opts || {};
    const self = this;

    // this writes to the actual connection
    function writeToEngine(encodedPackets) {
      if (opts.volatile && !self.conn.transport.writable) return;
      for (let i = 0; i < encodedPackets.length; i++) {
        self.conn.write(encodedPackets[i], { compress: opts.compress });
      }
    }

    if ("open" == this.conn.readyState) {
      debug("writing packet %j", packet);
      if (!opts.preEncoded) {
        // not broadcasting, need to encode
        writeToEngine(this.encoder.encode(packet)); // encode, then write results to engine
      } else {
        // a broadcast pre-encodes a packet
        writeToEngine(packet);
      }
    } else {
      debug("ignoring packet write %j", packet);
    }
  }

  /**
   * Called with incoming transport data.
   *
   * @private
   */
  private ondata(data) {
    // try/catch is needed for protocol violations (GH-1880)
    try {
      this.decoder.add(data);
    } catch (e) {
      this.onerror(e);
    }
  }

  /**
   * Called when parser fully decodes a packet.
   *
   * @private
   */
  private ondecoded(packet: Packet) {
    if (PacketType.CONNECT == packet.type) {
      this.connect(packet.nsp, packet.data);
    } else {
      const socket = this.nsps.get(packet.nsp);
      if (socket) {
        process.nextTick(function() {
          socket._onpacket(packet);
        });
      } else {
        debug("no socket for namespace %s", packet.nsp);
      }
    }
  }

  /**
   * Handles an error.
   *
   * @param {Object} err object
   * @private
   */
  private onerror(err) {
    for (const socket of this.sockets.values()) {
      socket._onerror(err);
    }
    this.conn.close();
  }

  /**
   * Called upon transport close.
   *
   * @param reason
   * @private
   */
  private onclose(reason: string) {
    debug("client close with reason %s", reason);

    // ignore a potential subsequent `close` event
    this.destroy();

    // `nsps` and `sockets` are cleaned up seamlessly
    for (const socket of this.sockets.values()) {
      socket._onclose(reason);
    }
    this.sockets.clear();

    this.decoder.destroy(); // clean up decoder
  }

  /**
   * Cleans up event listeners.
   * @private
   */
  private destroy() {
    this.conn.removeListener("data", this.ondata);
    this.conn.removeListener("error", this.onerror);
    this.conn.removeListener("close", this.onclose);
    // @ts-ignore
    this.decoder.removeListener("decoded", this.ondecoded);
  }
}
