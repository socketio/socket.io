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
   * Writes a packet payload.
   *
   * @param {Array} packets
   * @api private
   */
  send(packets) {
    this.writable = false;

    for (let i = 0; i < packets.length; i++) {
      const packet = packets[i];
      const isLast = i + 1 === packets.length;

      const send = (data) => {
        const isBinary = typeof data !== "string";
        const compress =
          this.perMessageDeflate &&
          Buffer.byteLength(data) > this.perMessageDeflate.threshold;

        debug('writing "%s"', data);
        this.socket.send(data, isBinary, compress);

        if (isLast) {
          this.writable = true;
          this.emit("drain");
        }
      };

      if (packet.options && typeof packet.options.wsPreEncoded === "string") {
        send(packet.options.wsPreEncoded);
      } else {
        this.parser.encodePacket(packet, this.supportsBinary, send);
      }
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
    // call fn first since socket.end() immediately emits a "close" event
    this.socket.end();
  }
}
