import { XHR } from "./polling-xhr.js";
import { WS } from "./websocket.js";

export const transports = {
  websocket: WS,
  polling: XHR
};
