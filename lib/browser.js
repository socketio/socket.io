const hasBinary = require("has-binary2");
const sliceBuffer = require("arraybuffer.slice");
const after = require("after");
const utf8 = require("./utf8");

let base64encoder;
if (typeof ArrayBuffer !== "undefined") {
  base64encoder = require("base64-arraybuffer");
}

/**
 * Check if we are running an android browser. That requires us to use
 * ArrayBuffer with polling transports...
 *
 * http://ghinda.net/jpeg-blob-ajax-android/
 */
const isAndroid =
  typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);

/**
 * Check if we are running in PhantomJS.
 * Uploading a Blob with PhantomJS does not work correctly, as reported here:
 * https://github.com/ariya/phantomjs/issues/11395
 * @type boolean
 */
const isPhantomJS =
  typeof navigator !== "undefined" && /PhantomJS/i.test(navigator.userAgent);

/**
 * When true, avoids using Blobs to encode payloads.
 * @type boolean
 */
const dontSendBlobs = isAndroid || isPhantomJS;

/**
 * Current protocol version.
 */

exports.protocol = 3;

/**
 * Packet types.
 */
const packets = (exports.packets = {
  open: 0, // non-ws
  close: 1, // non-ws
  ping: 2,
  pong: 3,
  message: 4,
  upgrade: 5,
  noop: 6
});

const packetslist = Object.keys(packets);

/**
 * Premade error packet.
 */
const err = { type: "error", data: "parser error" };

/**
 * Create a blob api even for blob builder when vendor prefixes exist
 */
const Blob = require("blob");

/**
 * Encodes a packet.
 *
 *     <packet type id> [ <data> ]
 *
 * Example:
 *
 *     5hello world
 *     3
 *     4
 *
 * Binary is encoded in an identical principle
 *
 * @api private
 */

exports.encodePacket = function(packet, supportsBinary, utf8encode, callback) {
  if (typeof supportsBinary === "function") {
    callback = supportsBinary;
    supportsBinary = false;
  }

  if (typeof utf8encode === "function") {
    callback = utf8encode;
    utf8encode = null;
  }

  const data =
    packet.data === undefined ? undefined : packet.data.buffer || packet.data;

  if (typeof ArrayBuffer !== "undefined" && data instanceof ArrayBuffer) {
    return encodeArrayBuffer(packet, supportsBinary, callback);
  } else if (typeof Blob !== "undefined" && data instanceof Blob) {
    return encodeBlob(packet, supportsBinary, callback);
  }

  // might be an object with { base64: true, data: dataAsBase64String }
  if (data && data.base64) {
    return encodeBase64Object(packet, callback);
  }

  // Sending data as a utf-8 string
  let encoded = packets[packet.type];

  // data fragment is optional
  if (undefined !== packet.data) {
    encoded += utf8encode
      ? utf8.encode(String(packet.data), { strict: false })
      : String(packet.data);
  }

  return callback("" + encoded);
};

function encodeBase64Object(packet, callback) {
  // packet data is an object { base64: true, data: dataAsBase64String }
  const message = "b" + exports.packets[packet.type] + packet.data.data;
  return callback(message);
}

/**
 * Encode packet helpers for binary types
 */

function encodeArrayBuffer(packet, supportsBinary, callback) {
  if (!supportsBinary) {
    return exports.encodeBase64Packet(packet, callback);
  }

  const data = packet.data;
  const contentArray = new Uint8Array(data);
  const resultBuffer = new Uint8Array(1 + data.byteLength);

  resultBuffer[0] = packets[packet.type];
  for (let i = 0; i < contentArray.length; i++) {
    resultBuffer[i + 1] = contentArray[i];
  }

  return callback(resultBuffer.buffer);
}

function encodeBlobAsArrayBuffer(packet, supportsBinary, callback) {
  if (!supportsBinary) {
    return exports.encodeBase64Packet(packet, callback);
  }

  const fr = new FileReader();
  fr.onload = function() {
    exports.encodePacket(
      { type: packet.type, data: fr.result },
      supportsBinary,
      true,
      callback
    );
  };
  return fr.readAsArrayBuffer(packet.data);
}

function encodeBlob(packet, supportsBinary, callback) {
  if (!supportsBinary) {
    return exports.encodeBase64Packet(packet, callback);
  }

  if (dontSendBlobs) {
    return encodeBlobAsArrayBuffer(packet, supportsBinary, callback);
  }

  const length = new Uint8Array(1);
  length[0] = packets[packet.type];
  const blob = new Blob([length.buffer, packet.data]);

  return callback(blob);
}

/**
 * Encodes a packet with binary data in a base64 string
 *
 * @param {Object} packet, has `type` and `data`
 * @return {String} base64 encoded message
 */

exports.encodeBase64Packet = function(packet, callback) {
  let message = "b" + exports.packets[packet.type];
  if (typeof Blob !== "undefined" && packet.data instanceof Blob) {
    const fr = new FileReader();
    fr.onload = function() {
      const b64 = fr.result.split(",")[1];
      callback(message + b64);
    };
    return fr.readAsDataURL(packet.data);
  }

  let b64data;
  try {
    b64data = String.fromCharCode.apply(null, new Uint8Array(packet.data));
  } catch (e) {
    // iPhone Safari doesn't let you apply with typed arrays
    const typed = new Uint8Array(packet.data);
    const basic = new Array(typed.length);
    for (let i = 0; i < typed.length; i++) {
      basic[i] = typed[i];
    }
    b64data = String.fromCharCode.apply(null, basic);
  }
  message += btoa(b64data);
  return callback(message);
};

/**
 * Decodes a packet. Changes format to Blob if requested.
 *
 * @return {Object} with `type` and `data` (if any)
 * @api private
 */

exports.decodePacket = function(data, binaryType, utf8decode) {
  if (data === undefined) {
    return err;
  }
  // String data
  if (typeof data === "string") {
    if (data.charAt(0) === "b") {
      return exports.decodeBase64Packet(data.substr(1), binaryType);
    }

    if (utf8decode) {
      data = tryDecode(data);
      if (data === false) {
        return err;
      }
    }
    const type = data.charAt(0);

    if (Number(type) != type || !packetslist[type]) {
      return err;
    }

    if (data.length > 1) {
      return { type: packetslist[type], data: data.substring(1) };
    } else {
      return { type: packetslist[type] };
    }
  }

  const asArray = new Uint8Array(data);
  const type = asArray[0];
  let rest = sliceBuffer(data, 1);
  if (Blob && binaryType === "blob") {
    rest = new Blob([rest]);
  }
  return { type: packetslist[type], data: rest };
};

function tryDecode(data) {
  try {
    data = utf8.decode(data, { strict: false });
  } catch (e) {
    return false;
  }
  return data;
}

/**
 * Decodes a packet encoded in a base64 string
 *
 * @param {String} base64 encoded message
 * @return {Object} with `type` and `data` (if any)
 */

exports.decodeBase64Packet = function(msg, binaryType) {
  const type = packetslist[msg.charAt(0)];
  if (!base64encoder) {
    return { type: type, data: { base64: true, data: msg.substr(1) } };
  }

  let data = base64encoder.decode(msg.substr(1));

  if (binaryType === "blob" && Blob) {
    data = new Blob([data]);
  }

  return { type: type, data: data };
};

/**
 * Encodes multiple messages (payload).
 *
 *     <length>:data
 *
 * Example:
 *
 *     11:hello world2:hi
 *
 * If any contents are binary, they will be encoded as base64 strings. Base64
 * encoded strings are marked with a b before the length specifier
 *
 * @param {Array} packets
 * @api private
 */

exports.encodePayload = function(packets, supportsBinary, callback) {
  if (typeof supportsBinary === "function") {
    callback = supportsBinary;
    supportsBinary = null;
  }

  const isBinary = hasBinary(packets);

  if (supportsBinary && isBinary) {
    if (Blob && !dontSendBlobs) {
      return exports.encodePayloadAsBlob(packets, callback);
    }

    return exports.encodePayloadAsArrayBuffer(packets, callback);
  }

  if (!packets.length) {
    return callback("0:");
  }

  function setLengthHeader(message) {
    return message.length + ":" + message;
  }

  function encodeOne(packet, doneCallback) {
    exports.encodePacket(
      packet,
      !isBinary ? false : supportsBinary,
      false,
      function(message) {
        doneCallback(null, setLengthHeader(message));
      }
    );
  }

  map(packets, encodeOne, function(err, results) {
    return callback(results.join(""));
  });
};

/**
 * Async array map using after
 */

function map(ary, each, done) {
  const result = new Array(ary.length);
  const next = after(ary.length, done);

  const eachWithIndex = function(i, el, cb) {
    each(el, function(error, msg) {
      result[i] = msg;
      cb(error, result);
    });
  };

  for (let i = 0; i < ary.length; i++) {
    eachWithIndex(i, ary[i], next);
  }
}

/*
 * Decodes data when a payload is maybe expected. Possible binary contents are
 * decoded from their base64 representation
 *
 * @param {String} data, callback method
 * @api public
 */

exports.decodePayload = function(data, binaryType, callback) {
  if (typeof data !== "string") {
    return exports.decodePayloadAsBinary(data, binaryType, callback);
  }

  if (typeof binaryType === "function") {
    callback = binaryType;
    binaryType = null;
  }

  let packet;
  if (data === "") {
    // parser error - ignoring payload
    return callback(err, 0, 1);
  }

  let length = "",
    n,
    msg;

  let i = 0;
  const l = data.length;
  for (; i < l; i++) {
    const chr = data.charAt(i);

    if (chr !== ":") {
      length += chr;
      continue;
    }

    if (length === "" || length != (n = Number(length))) {
      // parser error - ignoring payload
      return callback(err, 0, 1);
    }

    msg = data.substr(i + 1, n);

    if (length != msg.length) {
      // parser error - ignoring payload
      return callback(err, 0, 1);
    }

    if (msg.length) {
      packet = exports.decodePacket(msg, binaryType, false);

      if (err.type === packet.type && err.data === packet.data) {
        // parser error in individual packet - ignoring payload
        return callback(err, 0, 1);
      }

      const ret = callback(packet, i + n, l);
      if (false === ret) return;
    }

    // advance cursor
    i += n;
    length = "";
  }

  if (length !== "") {
    // parser error - ignoring payload
    return callback(err, 0, 1);
  }
};

/**
 * Encodes multiple messages (payload) as binary.
 *
 * <1 = binary, 0 = string><number from 0-9><number from 0-9>[...]<number
 * 255><data>
 *
 * Example:
 * 1 3 255 1 2 3, if the binary contents are interpreted as 8 bit integers
 *
 * @param {Array} packets
 * @return {ArrayBuffer} encoded payload
 * @api private
 */

exports.encodePayloadAsArrayBuffer = function(packets, callback) {
  if (!packets.length) {
    return callback(new ArrayBuffer(0));
  }

  function encodeOne(packet, doneCallback) {
    exports.encodePacket(packet, true, true, function(data) {
      return doneCallback(null, data);
    });
  }

  map(packets, encodeOne, function(err, encodedPackets) {
    const totalLength = encodedPackets.reduce(function(acc, p) {
      let len;
      if (typeof p === "string") {
        len = p.length;
      } else {
        len = p.byteLength;
      }
      return acc + len.toString().length + len + 2; // string/binary identifier + separator = 2
    }, 0);

    const resultArray = new Uint8Array(totalLength);

    let bufferIndex = 0;
    encodedPackets.forEach(function(p) {
      const isString = typeof p === "string";
      let ab = p;
      if (isString) {
        var view = new Uint8Array(p.length);
        for (let i = 0; i < p.length; i++) {
          view[i] = p.charCodeAt(i);
        }
        ab = view.buffer;
      }

      if (isString) {
        // not true binary
        resultArray[bufferIndex++] = 0;
      } else {
        // true binary
        resultArray[bufferIndex++] = 1;
      }

      const lenStr = ab.byteLength.toString();
      for (let i = 0; i < lenStr.length; i++) {
        resultArray[bufferIndex++] = parseInt(lenStr[i]);
      }
      resultArray[bufferIndex++] = 255;

      var view = new Uint8Array(ab);
      for (let i = 0; i < view.length; i++) {
        resultArray[bufferIndex++] = view[i];
      }
    });

    return callback(resultArray.buffer);
  });
};

/**
 * Encode as Blob
 */

exports.encodePayloadAsBlob = function(packets, callback) {
  function encodeOne(packet, doneCallback) {
    exports.encodePacket(packet, true, true, function(encoded) {
      const binaryIdentifier = new Uint8Array(1);
      binaryIdentifier[0] = 1;
      if (typeof encoded === "string") {
        const view = new Uint8Array(encoded.length);
        for (let i = 0; i < encoded.length; i++) {
          view[i] = encoded.charCodeAt(i);
        }
        encoded = view.buffer;
        binaryIdentifier[0] = 0;
      }

      const len =
        encoded instanceof ArrayBuffer ? encoded.byteLength : encoded.size;

      const lenStr = len.toString();
      const lengthAry = new Uint8Array(lenStr.length + 1);
      for (let i = 0; i < lenStr.length; i++) {
        lengthAry[i] = parseInt(lenStr[i]);
      }
      lengthAry[lenStr.length] = 255;

      if (Blob) {
        const blob = new Blob([
          binaryIdentifier.buffer,
          lengthAry.buffer,
          encoded
        ]);
        doneCallback(null, blob);
      }
    });
  }

  map(packets, encodeOne, function(err, results) {
    return callback(new Blob(results));
  });
};

/*
 * Decodes data when a payload is maybe expected. Strings are decoded by
 * interpreting each byte as a key code for entries marked to start with 0. See
 * description of encodePayloadAsBinary
 *
 * @param {ArrayBuffer} data, callback method
 * @api public
 */

exports.decodePayloadAsBinary = function(data, binaryType, callback) {
  if (typeof binaryType === "function") {
    callback = binaryType;
    binaryType = null;
  }

  let bufferTail = data;
  const buffers = [];

  while (bufferTail.byteLength > 0) {
    const tailArray = new Uint8Array(bufferTail);
    const isString = tailArray[0] === 0;
    let msgLength = "";

    for (let i = 1; ; i++) {
      if (tailArray[i] === 255) break;

      // 310 = char length of Number.MAX_VALUE
      if (msgLength.length > 310) {
        return callback(err, 0, 1);
      }

      msgLength += tailArray[i];
    }

    bufferTail = sliceBuffer(bufferTail, 2 + msgLength.length);
    msgLength = parseInt(msgLength);

    let msg = sliceBuffer(bufferTail, 0, msgLength);
    if (isString) {
      try {
        msg = String.fromCharCode.apply(null, new Uint8Array(msg));
      } catch (e) {
        // iPhone Safari doesn't let you apply to typed arrays
        const typed = new Uint8Array(msg);
        msg = "";
        for (let i = 0; i < typed.length; i++) {
          msg += String.fromCharCode(typed[i]);
        }
      }
    }

    buffers.push(msg);
    bufferTail = sliceBuffer(bufferTail, msgLength);
  }

  const total = buffers.length;
  buffers.forEach(function(buffer, i) {
    callback(exports.decodePacket(buffer, binaryType, true), i, total);
  });
};
