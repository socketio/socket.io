import { Transport } from "../transport.js";
import { pick, randomString } from "../util.js";
import { encodePacket } from "engine.io-parser";
import type { Packet, RawData } from "engine.io-parser";
import { globalThisShim as globalThis, nextTick } from "../globals.node.js";
import debugModule from "debug"; // debug()

const debug = debugModule("engine.io-client:websocket"); // debug()

// detect ReactNative environment
const isReactNative =
  typeof navigator !== "undefined" &&
  typeof navigator.product === "string" &&
  navigator.product.toLowerCase() === "reactnative";

export abstract class BaseWS extends Transport {
  protected ws: any;

  override get name() {
    return "websocket";
  }

  override doOpen() {
    const uri = this.uri();
    const protocols = this.opts.protocols;

    // React Native only supports the 'headers' option, and will print a warning if anything else is passed
    const opts = isReactNative
      ? {}
      : pick(
          this.opts,
          "agent",
          "perMessageDeflate",
          "pfx",
          "key",
          "passphrase",
          "cert",
          "ca",
          "ciphers",
          "rejectUnauthorized",
          "localAddress",
          "protocolVersion",
          "origin",
          "maxPayload",
          "family",
          "checkServerIdentity",
        );

    if (this.opts.extraHeaders) {
      opts.headers = this.opts.extraHeaders;
    }

    try {
      this.ws = this.createSocket(uri, protocols, opts);
    } catch (err) {
      return this.emitReserved("error", err);
    }

    this.ws.binaryType = this.socket.binaryType;

    this.addEventListeners();
  }

  abstract createSocket(
    uri: string,
    protocols: string | string[] | undefined,
    opts: Record<string, any>,
  );

  /**
   * Adds event listeners to the socket
   *
   * @private
   */
  private addEventListeners() {
    this.ws.onopen = () => {
      if (this.opts.autoUnref) {
        this.ws._socket.unref();
      }
      this.onOpen();
    };
    this.ws.onclose = (closeEvent) =>
      this.onClose({
        description: "websocket connection closed",
        context: closeEvent,
      });
    this.ws.onmessage = (ev) => this.onData(ev.data);
    this.ws.onerror = (e) => this.onError("websocket error", e);
  }

  override write(packets) {
    this.writable = false;

    // encodePacket efficient as it uses WS framing
    // no need for encodePayload
    for (let i = 0; i < packets.length; i++) {
      const packet = packets[i];
      const lastPacket = i === packets.length - 1;

      encodePacket(packet, this.supportsBinary, (data) => {
        // Sometimes the websocket has already been closed but the browser didn't
        // have a chance of informing us about it yet, in that case send will
        // throw an error
        try {
          this.doWrite(packet, data);
        } catch (e) {
          debug("websocket closed before onclose event");
        }

        if (lastPacket) {
          // fake drain
          // defer to next tick to allow Socket to clear writeBuffer
          nextTick(() => {
            this.writable = true;
            this.emitReserved("drain");
          }, this.setTimeoutFn);
        }
      });
    }
  }

  abstract doWrite(packet: Packet, data: RawData);

  override doClose() {
    if (typeof this.ws !== "undefined") {
      this.ws.onerror = () => {};
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Generates uri for connection.
   *
   * @private
   */
  private uri() {
    const schema = this.opts.secure ? "wss" : "ws";
    const query: { b64?: number } = this.query || {};

    // append timestamp to URI
    if (this.opts.timestampRequests) {
      query[this.opts.timestampParam] = randomString();
    }

    // communicate binary support capabilities
    if (!this.supportsBinary) {
      query.b64 = 1;
    }

    return this.createUri(schema, query);
  }
}

/**
 * WebSocket transport based on the built-in `WebSocket` object.
 *
 * Usage: browser, Node.js (since v21), Deno, Bun
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
 * @see https://caniuse.com/mdn-api_websocket
 * @see https://nodejs.org/api/globals.html#websocket
 */
export class WS extends BaseWS {
  createSocket(
    uri: string,
    protocols: string | string[] | undefined,
    opts: Record<string, any>,
  ) {
    const WebSocketCtor = globalThis.WebSocket || globalThis.MozWebSocket;

    return !isReactNative
      ? protocols
        ? new WebSocketCtor(uri, protocols)
        : new WebSocketCtor(uri)
      : new WebSocketCtor(uri, protocols, opts);
  }

  doWrite(_packet: Packet, data: RawData) {
    this.ws.send(data);
  }
}
