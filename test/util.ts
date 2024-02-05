const areArraysEqual = (x, y) => {
  if (x.byteLength !== y.byteLength) return false;
  const xView = new Uint8Array(x),
    yView = new Uint8Array(y);
  for (let i = 0; i < x.byteLength; i++) {
    if (xView[i] !== yView[i]) return false;
  }
  return true;
};

const createArrayBuffer = (array) => {
  // Uint8Array.from() is not defined in IE 10/11
  const arrayBuffer = new ArrayBuffer(array.length);
  const view = new Uint8Array(arrayBuffer);
  for (let i = 0; i < array.length; i++) {
    view[i] = array[i];
  }
  return arrayBuffer;
};

export { areArraysEqual, createArrayBuffer };
