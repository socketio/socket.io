/**
 * Module dependencies.
 */

var keys = require('./keys');
var base64encoder = require('base64-arraybuffer');
var sliceBuffer = require('./slice-buffer');

/**
 * A utility for doing slicing, even when ArrayBuffer.prototype.slice doesn't
 * exist
 *
 * @api private
 */

/**
 * Current protocol version.
 */

exports.protocol = 2;

/**
 * Packet types.
 */

var packets = exports.packets = {
    open:     0    // non-ws
  , close:    1    // non-ws
  , ping:     2
  , pong:     3
  , message:  4
  , upgrade:  5
  , noop:     6
};

var packetslist = keys(packets);

/**
 * Premade error packet.
 */

var err = { type: 'error', data: 'parser error' };

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

exports.encodePacket = function (packet, supportsBinary) {
  var data = (packet.data === undefined)
    ? undefined
    : packet.data.buffer || packet.data;

  if (global.ArrayBuffer && data instanceof ArrayBuffer) {
    if (!supportsBinary) { return 'b' + exports.encodeBase64Packet(packet); }

    var contentArray = new Uint8Array(data);
    var resultBuffer = new Uint8Array(1 + data.byteLength);

    resultBuffer[0] = packets[packet.type];
    for (var i = 0; i < contentArray.length; i++) resultBuffer[i+1] = contentArray[i];
    return resultBuffer.buffer;
  }

  // Sending data as a utf-8 string
  var encoded = packets[packet.type];

  // data fragment is optional
  if (undefined !== packet.data) {
    encoded += String(packet.data);
  }

  return '' + encoded;

};

/**
 * Encodes a packet with binary data in a base64 string
 *
 * @param {Object} packet, has `type` and `data`
 * @return {String} base64 encoded message
 */

exports.encodeBase64Packet = function(packet) {
  var message = '' + exports.packets[packet.type];
  var b64data = String.fromCharCode.apply(null, new Uint8Array(packet.data));
  message += global.btoa(b64data);
  return message;
};

/**
 * Decodes a packet. Changes format to Blob if requested.
 *
 * @return {Object} with `type` and `data` (if any)
 * @api private
 */

exports.decodePacket = function (data, binaryType) {
  // String data
  if (typeof data == 'string' || data === undefined) {
    if (data.charAt(0) == 'b') {
      return exports.decodeBase64Packet(data.substr(1), binaryType);
    }

    var type = data.charAt(0);

    if (Number(type) != type || !packetslist[type]) {
      return err;
    }

    if (data.length > 1) {
      return { type: packetslist[type], data: data.substring(1) };
    } else {
      return { type: packetslist[type] };
    }
  }
  
  var asArray = new Uint8Array(data);
  var type = asArray[0];
  var rest = sliceBuffer(data, 1);
  if (global.Blob && Blob.prototype.slice && binaryType === 'blob') {
    rest = new Blob([rest]);
  }
  return { type: packetslist[type], data: rest };
};

/**
 * Decodes a packet encoded in a base64 string 
 *
 * @param {String} base64 encoded message
 * @return {Object} with `type` and `data` (if any)
 */

exports.decodeBase64Packet = function(msg, binaryType) {
  var type = packetslist[msg.charAt(0)];
  var data = (!global.ArrayBuffer)
    ? { base64: true, data: msg.substr(1) }
    : base64encoder.decode(msg.substr(1));

  if (binaryType === 'blob') data = new Blob([data]);
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

exports.encodePayload = function (packets, supportsBinary) {
  if (supportsBinary) { return exports.encodePayloadAsBinary(packets); }

  if (!packets.length) {
    return '0:';
  }

  var encoded = '';
  var message;

  for (var i = 0, l = packets.length; i < l; i++) {
    message = exports.encodePacket(packets[i], supportsBinary);
    encoded += message.length + ':' + message;
  }
  
  return encoded;
};

/*
 * Decodes data when a payload is maybe expected. Possible binary contents are
 * decoded from their base64 representation
 *
 * @param {String} data, callback method
 * @api public
 */

exports.decodePayload = function (data, binaryType, callback) {
  if (!(typeof data == 'string')) {
    return exports.decodePayloadAsBinary(data, binaryType, callback);
  }

  if (typeof binaryType === 'function') {
    callback = binaryType;
    binaryType = null;
  }

  var packet;
  if (data == '') {
    // parser error - ignoring payload
    return callback(err, 0, 1);
  }

  var length = ''
    , n, msg;

  for (var i = 0, l = data.length; i < l; i++) {
    var chr = data.charAt(i);
   
    if (':' != chr) {
      length += chr;
    } else {
      if ('' == length || (length != (n = Number(length)))) {
        // parser error - ignoring payload
        return callback(err, 0, 1);
      }

      msg = data.substr(i + 1, n);

      if (length != msg.length) {
        // parser error - ignoring payload
        return callback(err, 0, 1);
      }

      if (msg.length) {
        packet = exports.decodePacket(msg, binaryType);

        if (err.type == packet.type && err.data == packet.data) {
          // parser error in individual packet - ignoring payload
          return callback(err, 0, 1);
        }

        var ret = callback(packet, i + n, l);
        if (false === ret) return;
      }

      // advance cursor
      i += n;
      length = '';
    }
  }

  if (length != '') {
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

exports.encodePayloadAsBinary = function (packets) {
  if (!packets.length) {
    return new ArrayBuffer(0);
  }

  var encodedPackets = packets.map(exports.encodePacket);
  var totalLength = encodedPackets.reduce(function(acc, p) {
    var len;
    if (typeof p === 'string') len = p.length;
    else len = p.byteLength;
    return acc + (new String(len)).length + len + 2; // string/binary identifier + separator = 2
  }, 0);
  
  var resultArray = new Uint8Array(totalLength);

  var bufferIndex = 0;
  encodedPackets.forEach(function(p) {
    var isString = typeof p === 'string';
    var ab = p;
    if (isString) {
      var view = new Uint8Array(p.length);
      for (var i = 0; i < p.length; i++) view[i] = p.charCodeAt(i);
      ab = view.buffer;
    }

    if (isString) resultArray[bufferIndex++] = 0; // not true binary
    else resultArray[bufferIndex++] = 1; // true binary

    var lenStr = new String(ab.byteLength);
    for (var i = 0; i < lenStr.length; i++) resultArray[bufferIndex++] = parseInt(lenStr[i]);
    resultArray[bufferIndex++] = 255;

    var view = new Uint8Array(ab);
    for (var i = 0; i < view.length; i++) resultArray[bufferIndex++] = view[i];
  });

  return resultArray.buffer;
};

/*
 * Decodes data when a payload is maybe expected. Strings are decoded by
 * interpreting each byte as a key code for entries marked to start with 0. See
 * description of encodePayloadAsBinary
 *
 * @param {ArrayBuffer} data, callback method
 * @api public
 */

exports.decodePayloadAsBinary = function (data, binaryType, callback) {
  if (typeof binaryType === 'function') {
    callback = binaryType;
    binaryType = null;
  }

  var bufferTail = data;
  var buffers = [];

  while (bufferTail.byteLength > 0) {
    var tailArray = new Uint8Array(bufferTail);
    var isString = tailArray[0] == 0;
    var msgLength = '';
    for (var i = 1; ; i++) {
      if (tailArray[i] == 255) break;
      msgLength += tailArray[i];
    }
    bufferTail = sliceBuffer(bufferTail, 2 + msgLength.length);
    msgLength = parseInt(msgLength);

    var msg = sliceBuffer(bufferTail, 0, msgLength);
    if (isString) msg = String.fromCharCode.apply(null, new Uint8Array(msg));
    buffers.push(msg);
    bufferTail = sliceBuffer(bufferTail, msgLength);
  }

  var total = buffers.length;
  buffers.forEach(function(buffer, i) {
    callback(exports.decodePacket(buffer, binaryType), i, total);
  });
};
