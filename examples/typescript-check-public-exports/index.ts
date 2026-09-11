import { io } from "socket.io-client";

// Reproduces https://github.com/socketio/socket.io/issues/5307
//
// The public types of Socket / Manager (and the underlying Engine.IO Socket and
// its Transport) are parameterized by "reserved events" maps (SocketReservedEvents,
// ManagerReservedEvents, TransportReservedEvents, ...) that were not exported.
// An exported value whose inferred type references those maps therefore cannot
// be named during declaration emit: `tsc --declaration` fails with ts(4023).
const socket = io("https://example.com");

// `listeners` / `write` return (or accept) types that reference the reserved-events
// maps, forcing the declaration emitter to name them.
export const socketListeners = socket.listeners;
export const managerListeners = socket.io.listeners;
export const engineListeners = socket.io.engine.listeners;
export const transportListeners = socket.io.engine.transport.listeners;
export const engineWrite = socket.io.engine.write;
