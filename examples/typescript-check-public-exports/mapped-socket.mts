import { io } from "socket.io-client";

// Reactive stores expose the public properties of a Socket through mapped types.
// Declaration emit must be able to name the types used by those properties.
function publicProperties<T>(value: T): { [K in keyof T]: T[K] } {
  return value;
}

export const socket = publicProperties(io({ autoConnect: false }));
