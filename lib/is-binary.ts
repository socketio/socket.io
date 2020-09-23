const withNativeBuffer: boolean =
  typeof Buffer === "function" && typeof Buffer.isBuffer === "function";
const withNativeArrayBuffer: boolean = typeof ArrayBuffer === "function";

const isView = (obj: any) => {
  return typeof ArrayBuffer.isView === "function"
    ? ArrayBuffer.isView(obj)
    : obj.buffer instanceof ArrayBuffer;
};

const toString = Object.prototype.toString;
const withNativeBlob =
  typeof Blob === "function" ||
  (typeof Blob !== "undefined" &&
    toString.call(Blob) === "[object BlobConstructor]");
const withNativeFile =
  typeof File === "function" ||
  (typeof File !== "undefined" &&
    toString.call(File) === "[object FileConstructor]");

/**
 * Returns true if obj is a Buffer, an ArrayBuffer, a Blob or a File.
 *
 * @private
 */

export default function isBinary(obj: any) {
  return (
    (withNativeBuffer && Buffer.isBuffer(obj)) ||
    (withNativeArrayBuffer && (obj instanceof ArrayBuffer || isView(obj))) ||
    (withNativeBlob && obj instanceof Blob) ||
    (withNativeFile && obj instanceof File)
  );
}
