import { WebSocket } from "ws";
import type { Packet, RawData } from "engine.io-parser";
import { BaseWS } from "./websocket.js";

/**
 * WebSocket transport based on the `WebSocket` object provided by the `ws` package.
 *
 * Usage: Node.js, Deno (compat), Bun (compat)
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
 * @see https://caniuse.com/mdn-api_websocket
 */
export class WS extends BaseWS {
  createSocket(
    uri: string,
    protocols: string | string[] | undefined,
    opts: Record<string, any>
  ) {
    return new WebSocket(uri, protocols, opts);
  }

  doWrite(packet: Packet, data: RawData) {
    const opts: { compress?: boolean } = {};
    if (packet.options) {
      opts.compress = packet.options.compress;
    }

    if (this.opts.perMessageDeflate) {
      const len =
        // @ts-ignore
        "string" === typeof data ? Buffer.byteLength(data) : data.length;
      if (len < this.opts.perMessageDeflate.threshold) {
        opts.compress = false;
      }
    }

    this.ws.send(data, opts);
  }
}
