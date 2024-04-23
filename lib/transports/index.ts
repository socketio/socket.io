import { XHR } from "./polling-xhr.js";
import { WS } from "./websocket.js";
import { WT } from "./webtransport.js";

export const transports = {
  websocket: WS,
  webtransport: WT,
  polling: XHR,
};
