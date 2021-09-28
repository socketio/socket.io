import globalThis from "./globalThis.js";

export function pick(obj, ...attr) {
  return attr.reduce((acc, k) => {
    if (obj.hasOwnProperty(k)) {
      acc[k] = obj[k];
    }
    return acc;
  }, {});
}

// Keep a reference to the real timeout functions so they can be used when overridden
const NATIVE_SET_TIMEOUT = setTimeout;
const NATIVE_CLEAR_TIMEOUT = clearTimeout;

export function installTimerFunctions(obj, opts) {
  if (opts.useNativeTimers) {
    obj.setTimeoutFn = NATIVE_SET_TIMEOUT.bind(globalThis);
    obj.clearTimeoutFn = NATIVE_CLEAR_TIMEOUT.bind(globalThis);
  } else {
    obj.setTimeoutFn = setTimeout.bind(globalThis);
    obj.clearTimeoutFn = clearTimeout.bind(globalThis);
  }
}
