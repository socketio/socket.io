import { io } from "socket.io-client";

const isBrowser = typeof window !== "undefined";

// only create the Socket.IO client on the client side (no ssr)
export const socket = isBrowser ? io() : {};
