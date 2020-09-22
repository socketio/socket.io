const withNativeBuffer: boolean =
  typeof Buffer === "function" && typeof Buffer.isBuffer === "function";
const withNativeArrayBuffer: boolean = typeof ArrayBuffer === "function";

const isView = (obj: any) => {
  return typeof ArrayBuffer.isView === "function"
    ? ArrayBuffer.isView(obj)
    : obj.buffer instanceof ArrayBuffer;
};

/**
 * Returns true if obj is a buffer or an arraybuffer.
 *
 * @private
 */

export default function isBuf(obj) {
  return (
    (withNativeBuffer && Buffer.isBuffer(obj)) ||
    (withNativeArrayBuffer && (obj instanceof ArrayBuffer || isView(obj)))
  );
}
