import { Polling } from "./polling.js";
import { WS } from "./websocket.js";

export const transports = {
  websocket: WS,
  polling: Polling,
};
