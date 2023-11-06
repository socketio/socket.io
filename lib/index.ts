import { Socket } from "./socket.js";

export { Socket };
export { SocketOptions } from "./socket.js";
export const protocol = Socket.protocol;
export { Transport, TransportError } from "./transport.js";
export { transports } from "./transports/index.js";
export { installTimerFunctions } from "./util.js";
export { parse } from "./contrib/parseuri.js";
export { nextTick } from "./transports/websocket-constructor.js";
