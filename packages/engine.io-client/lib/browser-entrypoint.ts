import { Socket, SocketOptions } from "./socket.js";

export default (uri: string, opts: SocketOptions) => new Socket(uri, opts);
