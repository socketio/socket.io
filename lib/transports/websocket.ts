import { Transport } from "../transport";
import debugModule from "debug";

const debug = debugModule("engine:ws");

export class WebSocket extends Transport {
  protected perMessageDeflate: any;
  private socket: any;

  /**
   * WebSocket transport
   *
   * @param {http.IncomingMessage}
   * @api public
   */
  constructor(req) {
    super(req);
    this.socket = req.websocket;
    this.socket.on("message", (data, isBinary) => {
      const message = isBinary ? data : data.toString();
      debug('received "%s"', message);
      super.onData(message);
    });
    this.socket.once("close", this.onClose.bind(this));
    this.socket.on("error", this.onError.bind(this));
    this.writable = true;
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
    this.writable = false;

    for (let i = 0; i < packets.length; i++) {
      const packet = packets[i];
      const isLast = i + 1 === packets.length;

      // always creates a new object since ws modifies it
      const opts: { compress?: boolean } = {};
      if (packet.options) {
        opts.compress = packet.options.compress;
      }

      const onSent = (err) => {
        if (err) {
          return this.onError("write error", err.stack);
        } else if (isLast) {
          this.writable = true;
          this.emit("drain");
        }
      };

      const send = (data) => {
        if (this.perMessageDeflate) {
          const len =
            "string" === typeof data ? Buffer.byteLength(data) : data.length;
          if (len < this.perMessageDeflate.threshold) {
            opts.compress = false;
          }
        }
        debug('writing "%s"', data);
        this.socket.send(data, opts, onSent);
      };

      if (packet.options && typeof packet.options.wsPreEncoded === "string") {
        send(packet.options.wsPreEncoded);
      } else if (this._canSendPreEncodedFrame(packet)) {
        // the WebSocket frame was computed with WebSocket.Sender.frame()
        // see https://github.com/websockets/ws/issues/617#issuecomment-283002469
        this.socket._sender.sendFrame(packet.options.wsPreEncodedFrame, onSent);
      } else {
        this.parser.encodePacket(packet, this.supportsBinary, send);
      }
    }
  }

  /**
   * Whether the encoding of the WebSocket frame can be skipped.
   * @param packet
   * @private
   */
  private _canSendPreEncodedFrame(packet) {
    return (
      !this.perMessageDeflate &&
      typeof this.socket?._sender?.sendFrame === "function" &&
      packet.options?.wsPreEncodedFrame !== undefined
    );
  }

  /**
   * Closes the transport.
   *
   * @api private
   */
  doClose(fn) {
    debug("closing");
    this.socket.close();
    fn && fn();
  }
}
