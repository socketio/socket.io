import { EventEmitter } from "events";
import * as parser_v4 from "engine.io-parser";
import * as parser_v3 from "./parser-v3/index";
import debugModule from "debug";
import type { IncomingMessage, ServerResponse } from "http";
import { Packet, RawData } from "engine.io-parser";

const debug = debugModule("engine:transport");

function noop() {}

type ReadyState = "open" | "closing" | "closed";

export type EngineRequest = IncomingMessage & {
  _query: Record<string, string>;
  res?: ServerResponse;
  cleanup?: Function;
  websocket?: any;
};

export abstract class Transport extends EventEmitter {
  /**
   * The session ID.
   */
  public sid: string;
  /**
   * Whether the transport is currently ready to send packets.
   */
  public writable = false;
  /**
   * The revision of the protocol:
   *
   * - 3 is used in Engine.IO v3 / Socket.IO v2
   * - 4 is used in Engine.IO v4 and above / Socket.IO v3 and above
   *
   * It is found in the `EIO` query parameters of the HTTP requests.
   *
   * @see https://github.com/socketio/engine.io-protocol
   */
  public protocol: number;

  /**
   * The current state of the transport.
   * @protected
   */
  protected _readyState: ReadyState = "open";
  /**
   * Whether the transport is discarded and can be safely closed (used during upgrade).
   * @protected
   */
  protected discarded = false;
  /**
   * The parser to use (depends on the revision of the {@link Transport#protocol}.
   * @protected
   */
  protected parser: any;
  /**
   * Whether the transport supports binary payloads (else it will be base64-encoded)
   * @protected
   */
  protected supportsBinary: boolean;

  get readyState() {
    return this._readyState;
  }

  set readyState(state: ReadyState) {
    debug(
      "readyState updated from %s to %s (%s)",
      this._readyState,
      state,
      this.name,
    );
    this._readyState = state;
  }

  /**
   * Transport constructor.
   *
   * @param {EngineRequest} req
   */
  constructor(req: { _query: Record<string, string> }) {
    super();
    this.protocol = req._query.EIO === "4" ? 4 : 3; // 3rd revision by default
    this.parser = this.protocol === 4 ? parser_v4 : parser_v3;
    this.supportsBinary = !(req._query && req._query.b64);
  }

  /**
   * Flags the transport as discarded.
   *
   * @package
   */
  discard() {
    this.discarded = true;
  }

  /**
   * Called with an incoming HTTP request.
   *
   * @param req
   * @package
   */
  onRequest(req: any) {}

  /**
   * Closes the transport.
   *
   * @package
   */
  close(fn?: () => void) {
    if ("closed" === this.readyState || "closing" === this.readyState) return;

    this.readyState = "closing";
    this.doClose(fn || noop);
  }

  /**
   * Called with a transport error.
   *
   * @param {String} msg - message error
   * @param {Object} desc - error description
   * @protected
   */
  protected onError(msg: string, desc?) {
    if (this.listeners("error").length) {
      const err = new Error(msg);
      // @ts-ignore
      err.type = "TransportError";
      // @ts-ignore
      err.description = desc;
      this.emit("error", err);
    } else {
      debug("ignored transport error %s (%s)", msg, desc);
    }
  }

  /**
   * Called with parsed out a packets from the data stream.
   *
   * @param {Object} packet
   * @protected
   */
  protected onPacket(packet: Packet) {
    this.emit("packet", packet);
  }

  /**
   * Called with the encoded packet data.
   *
   * @param {String} data
   * @protected
   */
  protected onData(data: RawData) {
    this.onPacket(this.parser.decodePacket(data));
  }

  /**
   * Called upon transport close.
   *
   * @protected
   */
  protected onClose() {
    this.readyState = "closed";
    this.emit("close");
  }

  /**
   * The name of the transport.
   */
  abstract get name(): string;

  /**
   * Sends an array of packets.
   *
   * @param {Array} packets
   * @package
   */
  abstract send(packets: Packet[]): void;

  /**
   * Closes the transport.
   */
  abstract doClose(fn?: () => void): void;
}
