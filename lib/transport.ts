import { EventEmitter } from "events";
import * as parser_v4 from "engine.io-parser";
import * as parser_v3 from "./parser-v3/index";
import debugModule from "debug";
import { IncomingMessage } from "http";
import { Packet } from "engine.io-parser";

const debug = debugModule("engine:transport");

/**
 * Noop function.
 *
 * @api private
 */

function noop() {}

export abstract class Transport extends EventEmitter {
  public sid: string;
  public writable: boolean;
  public protocol: number;

  protected _readyState: string;
  protected discarded: boolean;
  protected parser: any;
  protected req: IncomingMessage & { cleanup: Function };
  protected supportsBinary: boolean;

  get readyState() {
    return this._readyState;
  }

  set readyState(state) {
    debug(
      "readyState updated from %s to %s (%s)",
      this._readyState,
      state,
      this.name
    );
    this._readyState = state;
  }

  /**
   * Transport constructor.
   *
   * @param {http.IncomingMessage} request
   * @api public
   */
  constructor(req) {
    super();
    this.readyState = "open";
    this.discarded = false;
    this.protocol = req._query.EIO === "4" ? 4 : 3; // 3rd revision by default
    this.parser = this.protocol === 4 ? parser_v4 : parser_v3;
  }

  /**
   * Flags the transport as discarded.
   *
   * @api private
   */
  discard() {
    this.discarded = true;
  }

  /**
   * Called with an incoming HTTP request.
   *
   * @param {http.IncomingMessage} request
   * @api protected
   */
  protected onRequest(req) {
    debug("setting request");
    this.req = req;
  }

  /**
   * Closes the transport.
   *
   * @api private
   */
  close(fn?) {
    if ("closed" === this.readyState || "closing" === this.readyState) return;

    this.readyState = "closing";
    this.doClose(fn || noop);
  }

  /**
   * Called with a transport error.
   *
   * @param {String} message error
   * @param {Object} error description
   * @api protected
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
   * @api protected
   */
  protected onPacket(packet: Packet) {
    this.emit("packet", packet);
  }

  /**
   * Called with the encoded packet data.
   *
   * @param {String} data
   * @api protected
   */
  protected onData(data) {
    this.onPacket(this.parser.decodePacket(data));
  }

  /**
   * Called upon transport close.
   *
   * @api protected
   */
  protected onClose() {
    this.readyState = "closed";
    this.emit("close");
  }

  /**
   * Advertise framing support.
   */
  abstract get supportsFraming();

  /**
   * The name of the transport.
   */
  abstract get name();

  /**
   * Sends an array of packets.
   *
   * @param {Array} packets
   * @package
   */
  abstract send(packets);

  /**
   * Closes the transport.
   */
  abstract doClose(fn?);
}
