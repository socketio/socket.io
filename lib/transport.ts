import { decodePacket, Packet, RawData } from "engine.io-parser";
import { Emitter } from "@socket.io/component-emitter";
import { installTimerFunctions } from "./util.js";
import debugModule from "debug"; // debug()
import { SocketOptions } from "./socket.js";

const debug = debugModule("engine.io-client:transport"); // debug()

class TransportError extends Error {
  public readonly type = "TransportError";

  constructor(
    reason: string,
    readonly description: any,
    readonly context: any
  ) {
    super(reason);
  }
}

export interface CloseDetails {
  description: string;
  context?: CloseEvent | XMLHttpRequest;
}

interface TransportReservedEvents {
  open: () => void;
  error: (err: TransportError) => void;
  packet: (packet: Packet) => void;
  close: (details?: CloseDetails) => void;
  poll: () => void;
  pollComplete: () => void;
  drain: () => void;
}

export abstract class Transport extends Emitter<
  {},
  {},
  TransportReservedEvents
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
   * @param {String} reason
   * @param description
   * @param context - the error context
   * @return {Transport} for chaining
   * @api protected
   */
  protected onError(reason: string, description: any, context?: any) {
    super.emitReserved(
      "error",
      new TransportError(reason, description, context)
    );
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
    super.emitReserved("open");
  }

  /**
   * Called with data.
   *
   * @param {String} data
   * @api protected
   */
  protected onData(data: RawData) {
    const packet = decodePacket(data, this.socket.binaryType);
    this.onPacket(packet);
  }

  /**
   * Called with a decoded packet.
   *
   * @api protected
   */
  protected onPacket(packet: Packet) {
    super.emitReserved("packet", packet);
  }

  /**
   * Called upon close.
   *
   * @api protected
   */
  protected onClose(details?: CloseDetails) {
    this.readyState = "closed";
    super.emitReserved("close", details);
  }

  protected abstract doOpen();
  protected abstract doClose();
  protected abstract write(packets);
}
