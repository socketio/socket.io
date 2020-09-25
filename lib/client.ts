import { Decoder, Encoder, PacketType } from "socket.io-parser";
import url from "url";
import debugModule = require("debug");
import { IncomingMessage } from "http";
import { Server } from "./index";
import { Socket } from "./socket";
import { SocketId } from "socket.io-adapter";

const debug = debugModule("socket.io:client");

export class Client {
  public readonly conn;
  /** @package */
  public readonly id: string;

  private readonly server;
  private readonly encoder: Encoder;
  private readonly decoder: Decoder;
  private sockets: Map<SocketId, Socket> = new Map();
  private nsps: Map<string, Socket> = new Map();
  private connectBuffer: Array<string> = [];

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
    this.decoder = new server.parser.Decoder();
    this.id = conn.id;
    this.setup();
  }

  /**
   * @return the reference to the request that originated the Engine.IO connection
   */
  public get request(): IncomingMessage {
    return this.conn.request;
  }

  /**
   * Sets up event listeners.
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
  }

  /**
   * Connects a client to a namespace.
   *
   * @param {String} name namespace
   * @param {Object} query the query parameters
   * @package
   */
  public connect(name, query = {}) {
    if (this.server.nsps.has(name)) {
      debug("connecting to namespace %s", name);
      return this.doConnect(name, query);
    }

    this.server.checkNamespace(name, query, dynamicNsp => {
      if (dynamicNsp) {
        debug("dynamic namespace %s was created", dynamicNsp.name);
        this.doConnect(name, query);
      } else {
        debug("creation of namespace %s was denied", name);
        this.packet({
          type: PacketType.ERROR,
          nsp: name,
          data: "Invalid namespace"
        });
      }
    });
  }

  /**
   * Connects a client to a namespace.
   *
   * @param {String} name namespace
   * @param {String} query the query parameters
   */
  private doConnect(name, query) {
    const nsp = this.server.of(name);

    if ("/" != name && !this.nsps.has("/")) {
      this.connectBuffer.push(name);
      return;
    }

    const socket = nsp.add(this, query, () => {
      this.sockets.set(socket.id, socket);
      this.nsps.set(nsp.name, socket);

      if ("/" == nsp.name && this.connectBuffer.length > 0) {
        this.connectBuffer.forEach(this.connect, this);
        this.connectBuffer = [];
      }
    });
  }

  /**
   * Disconnects from all namespaces and closes transport.
   *
   * @package
   */
  public disconnect() {
    for (const socket of this.sockets.values()) {
      socket.disconnect();
    }
    this.sockets.clear();
    this.close();
  }

  /**
   * Removes a socket. Called by each `Socket`.
   *
   * @package
   */
  public remove(socket: Socket) {
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
   * @package
   */
  public packet(packet, opts?) {
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
   */
  private ondecoded(packet) {
    if (PacketType.CONNECT == packet.type) {
      this.connect(
        url.parse(packet.nsp).pathname,
        url.parse(packet.nsp, true).query
      );
    } else {
      const socket = this.nsps.get(packet.nsp);
      if (socket) {
        process.nextTick(function() {
          socket.onpacket(packet);
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
   */
  private onerror(err) {
    for (const socket of this.sockets.values()) {
      socket.onerror(err);
    }
    this.conn.close();
  }

  /**
   * Called upon transport close.
   *
   * @param reason
   */
  private onclose(reason: string) {
    debug("client close with reason %s", reason);

    // ignore a potential subsequent `close` event
    this.destroy();

    // `nsps` and `sockets` are cleaned up seamlessly
    for (const socket of this.sockets.values()) {
      socket.onclose(reason);
    }
    this.sockets.clear();

    this.decoder.destroy(); // clean up decoder
  }

  /**
   * Cleans up event listeners.
   */
  private destroy() {
    this.conn.removeListener("data", this.ondata);
    this.conn.removeListener("error", this.onerror);
    this.conn.removeListener("close", this.onclose);
    // @ts-ignore
    this.decoder.removeListener("decoded", this.ondecoded);
  }
}
