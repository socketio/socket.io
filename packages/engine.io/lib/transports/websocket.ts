import { EngineRequest, Transport } from "../transport";
import debugModule from "debug";
import type { Packet, RawData } from "engine.io-parser";

const debug = debugModule("engine:ws");

export class WebSocket extends Transport {
  protected perMessageDeflate: any;
  private socket: any;

  /**
   * WebSocket transport
   *
   * @param {EngineRequest} req
   */
  constructor(req: EngineRequest) {
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

  send(packets: Packet[]) {
    this.writable = false;

    for (let i = 0; i < packets.length; i++) {
      const packet = packets[i];
      const isLast = i + 1 === packets.length;

      if (this._canSendPreEncodedFrame(packet)) {
        // the WebSocket frame was computed with WebSocket.Sender.frame()
        // see https://github.com/websockets/ws/issues/617#issuecomment-283002469
        this.socket._sender.sendFrame(
          // @ts-ignore
          packet.options.wsPreEncodedFrame,
          isLast ? this._onSentLast : this._onSent,
        );
      } else {
        this.parser.encodePacket(
          packet,
          this.supportsBinary,
          isLast ? this._doSendLast : this._doSend,
        );
      }
    }
  }

  /**
   * Whether the encoding of the WebSocket frame can be skipped.
   * @param packet
   * @private
   */
  private _canSendPreEncodedFrame(packet: Packet) {
    return (
      !this.perMessageDeflate &&
      typeof this.socket?._sender?.sendFrame === "function" &&
      // @ts-ignore
      packet.options?.wsPreEncodedFrame !== undefined
    );
  }

  private _doSend = (data: RawData) => {
    this.socket.send(data, this._onSent);
  };

  private _doSendLast = (data: RawData) => {
    this.socket.send(data, this._onSentLast);
  };

  private _onSent = (err?: Error) => {
    if (err) {
      this.onError("write error", err.stack);
    }
  };

  private _onSentLast = (err?: Error) => {
    if (err) {
      this.onError("write error", err.stack);
    } else {
      this.emit("drain");
      this.writable = true;
      this.emit("ready");
    }
  };

  doClose(fn?: () => void) {
    debug("closing");
    this.socket.close();
    fn && fn();
  }
}
