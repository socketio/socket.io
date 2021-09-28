import { Socket } from "./socket.js";

export default (uri, opts) => new Socket(uri, opts);

/**
 * Expose deps for legacy compatibility
 * and standalone browser access.
 */
export { Socket };
export { SocketOptions } from "./socket.js";
export const protocol = Socket.protocol;
export { Transport } from "./transport.js";
export { transports } from "./transports/index.js";
export { installTimerFunctions } from "./util.js";
