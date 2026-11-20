import { Transport } from "../transport";
import debugModule from "debug";

const debug = debugModule("engine:ws");

export class WebSocket extends Transport {
  private socket: any;

  /**
   * Transport name
   */
  get name() {
    return "websocket";
  }

  /**
   * Advertise upgrade support.
   */
  get handlesUpgrades() {
    return true;
  }

  /**
   * Writes a packet payload.
   *
   * @param {Array} packets
   * @private
   */
  send(packets) {
    this.writable = false;

    for (let i = 0; i < packets.length; i++) {
      const packet = packets[i];
      const isLast = i + 1 === packets.length;

      const send = (data) => {
        const isBinary = typeof data !== "string";
        const compress =
          this.opts.perMessageDeflate &&
          Buffer.byteLength(data) > this.opts.perMessageDeflate.threshold;

        debug('writing "%s"', data);
        this.socket.send(data, isBinary, compress);

        if (isLast) {
          this.emit("drain");
          this.writable = true;
          this.emit("ready");
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
   * @private
   */
  doClose(fn) {
    debug("closing");
    fn && fn();
    // call fn first since socket.end() immediately emits a "close" event
    this.socket.end();
  }
}
