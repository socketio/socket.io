export const nextTick = (() => {
    return (cb: CallbackFn) => Promise.resolve().then(cb);
})();

export const globalThisShim = globalThis;

export const defaultBinaryType = "arraybuffer";

export function createCookieJar() {}

type CallbackFn = () => void;
