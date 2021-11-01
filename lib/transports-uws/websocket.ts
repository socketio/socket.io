import { Transport } from "../transport";
import debugModule from "debug";

const debug = debugModule("engine:ws");

export class WebSocket extends Transport {
  protected perMessageDeflate: any;
  private socket: any;

  /**
   * WebSocket transport
   *
   * @param req
   * @api public
   */
  constructor(req) {
    super(req);
    this.writable = false;
    this.perMessageDeflate = null;
  }

  /**
   * Transport name
   *
   * @api public
   */
  get name() {
    return "websocket";
  }

  /**
   * Advertise upgrade support.
   *
   * @api public
   */
  get handlesUpgrades() {
    return true;
  }

  /**
   * Advertise framing support.
   *
   * @api public
   */
  get supportsFraming() {
    return true;
  }

  /**
   * Writes a packet payload.
   *
   * @param {Array} packets
   * @api private
   */
  send(packets) {
    const packet = packets.shift();
    if (typeof packet === "undefined") {
      this.writable = true;
      this.emit("drain");
      return;
    }

    // always creates a new object since ws modifies it
    const opts: { compress?: boolean } = {};
    if (packet.options) {
      opts.compress = packet.options.compress;
    }

    const send = data => {
      const isBinary = typeof data !== "string";
      const compress =
        this.perMessageDeflate &&
        Buffer.byteLength(data) > this.perMessageDeflate.threshold;

      debug('writing "%s"', data);
      this.writable = false;

      this.socket.send(data, isBinary, compress);
      this.send(packets);
    };

    if (packet.options && typeof packet.options.wsPreEncoded === "string") {
      send(packet.options.wsPreEncoded);
    } else {
      this.parser.encodePacket(packet, this.supportsBinary, send);
    }
  }

  /**
   * Closes the transport.
   *
   * @api private
   */
  doClose(fn) {
    debug("closing");
    fn && fn();
    // call fn first since socket.close() immediately emits a "close" event
    this.socket.close();
  }
}
