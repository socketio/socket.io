import { Polling as XHR } from "./polling";
import { JSONP } from "./polling-jsonp";
import { WebSocket } from "./websocket";
import { WebTransport } from "./webtransport";
import type { EngineRequest, TransportOptions } from "../transport";

export default {
  polling,
  websocket: WebSocket,
  webtransport: WebTransport,
};

/**
 * Polling polymorphic constructor.
 */
function polling(req: EngineRequest, opts: TransportOptions) {
  if ("string" === typeof req._query.j) {
    return new JSONP(req, opts);
  } else {
    return new XHR(req, opts);
  }
}

polling.upgradesTo = ["websocket", "webtransport"];
