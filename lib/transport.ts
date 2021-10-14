import { decodePacket } from "engine.io-parser";
import { DefaultEventsMap, Emitter } from "@socket.io/component-emitter";
import { installTimerFunctions } from "./util.js";
import debugModule from "debug"; // debug()
import { SocketOptions } from "./socket.js";

const debug = debugModule("engine.io-client:transport"); // debug()

export abstract class Transport extends Emitter<
  DefaultEventsMap,
  DefaultEventsMap
> {
  protected opts: SocketOptions;
  protected supportsBinary: boolean;
  protected query: object;
  protected readyState: string;
  protected writable: boolean = false;
  protected socket: any;
  protected setTimeoutFn: typeof setTimeout;

  /**
   * Transport abstract constructor.
   *
   * @param {Object} options.
   * @api private
   */
  constructor(opts) {
    super();
    installTimerFunctions(this, opts);

    this.opts = opts;
    this.query = opts.query;
    this.readyState = "";
    this.socket = opts.socket;
  }

  /**
   * Emits an error.
   *
   * @param {String} str
   * @return {Transport} for chaining
   * @api protected
   */
  protected onError(msg, desc) {
    const err = new Error(msg);
    // @ts-ignore
    err.type = "TransportError";
    // @ts-ignore
    err.description = desc;
    super.emit("error", err);
    return this;
  }

  /**
   * Opens the transport.
   *
   * @api public
   */
  private open() {
    if ("closed" === this.readyState || "" === this.readyState) {
      this.readyState = "opening";
      this.doOpen();
    }

    return this;
  }

  /**
   * Closes the transport.
   *
   * @api public
   */
  public close() {
    if ("opening" === this.readyState || "open" === this.readyState) {
      this.doClose();
      this.onClose();
    }

    return this;
  }

  /**
   * Sends multiple packets.
   *
   * @param {Array} packets
   * @api public
   */
  public send(packets) {
    if ("open" === this.readyState) {
      this.write(packets);
    } else {
      // this might happen if the transport was silently closed in the beforeunload event handler
      debug("transport is not open, discarding packets");
    }
  }

  /**
   * Called upon open
   *
   * @api protected
   */
  protected onOpen() {
    this.readyState = "open";
    this.writable = true;
    super.emit("open");
  }

  /**
   * Called with data.
   *
   * @param {String} data
   * @api protected
   */
  protected onData(data) {
    const packet = decodePacket(data, this.socket.binaryType);
    this.onPacket(packet);
  }

  /**
   * Called with a decoded packet.
   *
   * @api protected
   */
  protected onPacket(packet) {
    super.emit("packet", packet);
  }

  /**
   * Called upon close.
   *
   * @api protected
   */
  protected onClose() {
    this.readyState = "closed";
    super.emit("close");
  }

  protected abstract doOpen();
  protected abstract doClose();
  protected abstract write(packets);
}
