/**
 * Module dependencies.
 */

var keys = require('./keys');

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
  if (supportsBinary === undefined) { supportsBinary = true; }

  var data = (packet.data === undefined)
    ? undefined
    : packet.data.buffer || packet.data;

  if (data instanceof Buffer) {
    if (!supportsBinary) { return 'b' + exports.encodeBase64Packet(packet); }

    var typeBuffer = new Buffer(1);
    typeBuffer[0] = packets[packet.type];
    return Buffer.concat([typeBuffer, data]);

  } else if (data instanceof ArrayBuffer) {
    if (!supportsBinary) { return 'b' + exports.encodeBase64Packet(packet); }

    var contentArray = new Uint8Array(data);
    var resultBuffer = new Buffer(1 + data.byteLength);

    resultBuffer[0] = packets[packet.type];
    for (var i = 0; i < contentArray.length; i++) resultBuffer[i+1] = contentArray[i];
    return resultBuffer;
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

exports.encodeBase64Packet = function(packet){
  if (packet.data instanceof ArrayBuffer) {
    var buf = new Buffer(packet.data.byteLength);
    for (var i = 0; i < buf.length; i++) {
      buf[i] = packet.data[i];
    }
    packet.data = buf;
  }

  var message = '' + packets[packet.type];
  message += packet.data.toString('base64');
  return message;
};

/**
 * Decodes a packet. Data also available as an ArrayBuffer if requested.
 *
 * @return {Object} with `type` and `data` (if any)
 * @api private
 */

exports.decodePacket = function (data, binaryType) {
  // String data
  if (typeof data == 'string' || data === undefined) {
    if (data.charAt(0) == 'b') {
      return exports.decodeBase64Packet(data.substr(1));
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

  // Binary data
  if (binaryType === 'arraybuffer') {
    var type = data[0];
    var intArray = new Uint8Array(data.length - 1);
    for (var i = 1; i < data.length; i++) intArray[i - 1] = data[i];
    return { type: packetslist[type], data: intArray.buffer };
  }
  var type = data[0];
  return { type: packetslist[type], data: data.slice(1) };
};

/**
 * Decodes a packet encoded in a base64 string 
 *
 * @param {String} base64 encoded message
 * @return {Object} with `type` and `data` (if any)
 */

exports.decodeBase64Packet = function(msg, binaryType) {
  var type = packetslist[msg.charAt(0)];
  var data = new Buffer(msg.substr(1), 'base64');
  if (binaryType === 'arraybuffer') {
    var abv = new Uint8Array(data.length);
    for (var i = 0; i < abv.length; i++) abv[i] = data[i];
    data = abv.buffer;
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

exports.encodePayload = function (packets, supportsBinary) {
  if (supportsBinary) { return exports.encodePayloadAsBinary(packets); }

  if (!packets.length) {
    return '0:';
  }

  var encoded = '';
  var message;

  for (var i = 0, l = packets.length; i < l; i++) {
    var message;
    if (packets[i].data instanceof Buffer) {
      message = exports.encodeBase64Packet(packets[i]);
      encoded += 'b' + message.length + ':' + message;
    } else {
      message = exports.encodePacket(packets[i]);
      encoded += message.length + ':' + message;
    }
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
  var base64 = false;
  if (data == '') {
    // parser error - ignoring payload
    return callback(err, 0, 1);
  }

  var length = ''
    , n, msg;

  for (var i = 0, l = data.length; i < l; i++) {
    var chr = data.charAt(i);
   
    if (chr == 'b') base64 = true;
    else if (':' != chr) {
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
        //packet = (base64)
        //  ? exports.decodePacket(new Buffer(msg, 'base64'), binaryType)
        //  : exports.decodePacket(msg, binaryType);
        if (base64) {
          packet = exports.decodeBase64Packet(msg, binaryType);
        } else {
          packet = exports.decodePacket(msg, binaryType);
        }

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
      base64 = false;
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
 * @return {Buffer} encoded payload
 * @api private
 */

exports.encodePayloadAsBinary = function (packets) {
  if (!packets.length) {
    return new Buffer(0);
  }

  return Buffer.concat(packets.map(function(p) {
    var packet = exports.encodePacket(p);
    var encodingLength = new String(packet.length);
    var sizeBuffer = new Buffer(encodingLength.length + 2);

    if (typeof packet === 'string') {
      sizeBuffer[0] = 0; // is a string (not true binary = 0)
      for (var i = 0; i < encodingLength.length; i++) {
        sizeBuffer[i + 1] = parseInt(encodingLength[i]);
      }
      sizeBuffer[sizeBuffer.length - 1] = 255;
      return Buffer.concat([sizeBuffer, new Buffer(packet, 'utf8')]);
    }

    sizeBuffer[0] = 1; // is binary (true binary = 1)
    for (var i = 0; i < encodingLength.length; i++) {
      sizeBuffer[i + 1] = parseInt(encodingLength[i]);
    }
    sizeBuffer[sizeBuffer.length - 1] = 255;
    return Buffer.concat([sizeBuffer, packet]);
  }));
};

/*
 * Decodes data when a payload is maybe expected. Strings are decoded by
 * interpreting each byte as a key code for entries marked to start with 0. See
 * description of encodePayloadAsBinary

 * @param {Buffer} data, callback method
 * @api public
 */

exports.decodePayloadAsBinary = function (data, binaryType, callback) {
  if (typeof binaryType === 'function') {
    callback = binaryType;
    binaryType = null;
  }

  var bufferTail = data;
  var buffers = [];
 
  while (bufferTail.length > 0) {
    var strLen = '';
    var isString = bufferTail[0] == 0;
    for (var i = 1; ; i++) {
      if (bufferTail[i] == 255)  break;
      strLen += new String(bufferTail[i]);
    }
    bufferTail = bufferTail.slice(strLen.length + 1);

    var msgLength = parseInt(strLen);

    var msg = bufferTail.slice(1, msgLength + 1);
    if (isString) msg = msg.toString('utf8');
    buffers.push(msg);
    bufferTail = bufferTail.slice(msgLength + 1);
  }

  var total = buffers.length;
  buffers.forEach(function(buffer, i) {
    callback(exports.decodePacket(buffer, binaryType), i, total);
  });
};
