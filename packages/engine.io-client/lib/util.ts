import { globalThisShim as globalThis } from "./globals.node.js";

export function pick<T, K extends keyof T>(obj: T, ...keys: K[]) {
  const ret: any = {};
  keys.forEach(key => {
    ret[key] = obj[key];
  })
  return ret;
}

// Keep a reference to the real timeout functions so they can be used when overridden
const NATIVE_SET_TIMEOUT = globalThis.setTimeout;
const NATIVE_CLEAR_TIMEOUT = globalThis.clearTimeout;

export function installTimerFunctions(obj: {setTimeoutFn, clearTimeoutFn}, opts: {useNativeTimers?: boolean}) {
  if (opts.useNativeTimers) {
    obj.setTimeoutFn = NATIVE_SET_TIMEOUT.bind(globalThis);
    obj.clearTimeoutFn = NATIVE_CLEAR_TIMEOUT.bind(globalThis);
  } else {
    obj.setTimeoutFn = globalThis.setTimeout.bind(globalThis);
    obj.clearTimeoutFn = globalThis.clearTimeout.bind(globalThis);
  }
}

export function byteLength(obj) {
  return new Blob([obj]).size;
}

/**
 * Generates a random 8-characters string.
 */
export function randomString() {
  return (
    Date.now().toString(36).substring(3) +
    Math.random().toString(36).substring(2, 5)
  );
}
