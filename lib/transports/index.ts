import { Polling } from "./polling.js";
import { WS } from "./websocket.js";
import { WT } from "./webtransport.js";

export const transports = {
  websocket: WS,
  webtransport: WT,
  polling: Polling,
};
