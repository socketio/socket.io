
/**
 * Module dependencies.
 */

var debug = require('debug')('socket.io-parser');
var json = require('json3');

/**
 * Protocol version.
 *
 * @api public
 */

exports.protocol = 1;

/**
 * Packet types.
 *
 * @api public
 */

exports.types = [
  'CONNECT',
  'DISCONNECT',
  'EVENT',
  'BINARY_EVENT',
  'ACK',
  'ERROR'
];

/**
 * Packet type `connect`.
 *
 * @api public
 */

exports.CONNECT = 0;

/**
 * Packet type `disconnect`.
 *
 * @api public
 */

exports.DISCONNECT = 1;

/**
 * Packet type `event`.
 *
 * @api public
 */

exports.EVENT = 2;

/**
 * Packet type `ack`.
 *
 * @api public
 */

exports.ACK = 3;

/**
 * Packet type `error`.
 *
 * @api public
 */

exports.ERROR = 4;

/**
 * Packet type 'binary event'
 *
 * @api public
 */

 exports.BINARY_EVENT = 5;

/**
 * Encode a packet as a string or buffer, depending on packet type.
 *
 * @param {Object} packet
 * @return {String | Buffer} encoded
 * @api public
 */

exports.encode = function(obj){
  debug('encoding packet %j', obj);
  if (obj.type === exports.BINARY_EVENT) {
    return encodeAsBinary(obj);
  }
  else {
    return encodeAsString(obj);
  }
};

/**
 * Encode packet as string (used for anything that is not a binary event).
 *
 * @param {Object} packet
 * @return {String} encoded
 * @api private
 */

function encodeAsString(obj) {
  var str = '';
  var nsp = false;

  // first is type
  str += obj.type;

  // if we have a namespace other than `/`
  // we append it followed by a comma `,`
  if (obj.nsp && '/' != obj.nsp) {
    nsp = true;
    str += obj.nsp;
  }

  // immediately followed by the id
  if (null != obj.id) {
    if (nsp) {
      str += ',';
      nsp = false;
    }
    str += obj.id;
  }

  // json data
  if (null != obj.data) {
    if (nsp) str += ',';
    str += json.stringify(obj.data);
  }

  debug('encoded %j as %s', obj, str);
  return str;
}

/**
 * Encode packet as Buffer (used for binary events).
 *
 * @param {Object} packet
 * @return {Buffer} encoded
 * @api private
 */

function encodeAsBinary(obj) {
  //console.log(obj);

  var buffers = [];

  // if there is a namespace, encode it
  if (obj.nsp && '/' != obj.nsp) {
    buffers.push(new Buffer('nsp' + obj.nsp, 'utf8'));
    buffers.push(new Buffer(',', 'utf8')); // separator
  }

  // if there is an id, encode it
  if (null != obj.id) {
    buffers.push(new Buffers('pid' + obj.id, 'utf8'));
    buffers.push(new Buffer(',', 'utf8')); // separator
  }

  // then encode the event name
  var eventName = obj.data[0];
  buffers.push(new Buffer(eventName, 'utf8'));
  buffers.push(new Buffer(',', 'utf8')); // separator


  function encodeObject(obj) {
    for (var key in obj) {
      var val = obj[key];
      if (Buffer.isBuffer(val)) {
        buffers.push(val);
        buffers.push(new Buffer(',', 'utf8')); // seperator
      }
      else if ('object' === typeof val) {
        encodeObject(val);
      }
      else {
        buffers.push(new Buffer(val, 'utf8'));
        buffers.push(new Buffer(',', 'utf8')); // seperator
      }
    }
  }

  // then add the actual data
  for (var i=1; i < obj.data.length; i++) {
    var d = obj.data[i];
    if (Buffer.isBuffer(d)) {
      buffers.push(d);
      buffers.push(new Buffer(',', 'utf8')); // seperator
    }
    else {
      buffers.push(encodeObject(d));
    }
  }

  return Buffer.concat(buffers);
}

exports.decode = function(obj) {
  if ('string' === typeof obj) {
    return decodeString(obj);
  }
  else if (Buffer.isBuffer(obj)) {
    return decodeBuffer(obj);
  }
  else {
    throw new Error('type is weird: ' + obj);
  }
}

/**
 * Decode a packet String (JSON data)
 *
 * @param {String} str
 * @return {Object} packet
 * @api private
 */

function decodeString(str) {
  var p = {};
  var i = 0;

  // look up type
  p.type = Number(str.charAt(0));
  if (null == exports.types[p.type]) return error();

  // look up namespace (if any)
  if ('/' == str.charAt(i + 1)) {
    p.nsp = '';
    while (++i) {
      var c = str.charAt(i);
      if (',' == c) break;
      p.nsp += c;
      if (i + 1 == str.length) break;
    }
  } else {
    p.nsp = '/';
  }

  // look up id
  var next = str.charAt(i + 1);
  if ('' != next && Number(next) == next) {
    p.id = '';
    while (++i) {
      var c = str.charAt(i);
      if (null == c || Number(c) != c) {
        --i;
        break;
      }
      p.id += str.charAt(i);
      if (i + 1 == str.length) break;
    }
    p.id = Number(p.id);
  }

  // look up json data
  if (str.charAt(++i)) {
    try {
      p.data = json.parse(str.substr(i));
    } catch(e){
      return error();
    }
  }

  debug('decoded %s as %j', str, p);
  return p;
};

/**
 * Decode a packet Buffer (binary data)
 *
 * @param {Buffer} buf
 * @return {Object} packet
 * @api private
 */

function decodeBuffer(buf) {
  var p = {};
  var i = 0;
  var iChar;

  p.type = exports.BINARY_EVENT;

  // handle namespace if it is there
  if ('nsp' == buf.slice(0, 3).toString('utf8')) {
    var namespace = '';
    for (i = 3; ',' != (iChar = buf.slice(i, i+1).toString('utf8')) && i < buf.length; i++) {
      namespace += iChar;
    }
    p.nsp = namespace;
  }
  else {
    p.nsp = '/';
  }

  // handle id if its there
  if ('pid' == buf.slice(i, i+3).toString('utf8')) {
    var pid = '';
    for (i; ',' != (iChar = buf.slice(i, i+1).toString('utf8')) && i < buf.length; i++) {
      pid += iChar;
    }
    p.id = Number(pid);
  }

  // handle event name
  var eventName = '';
  for (i; ',' != (iChar = buf.slice(i, i+1).toString('utf8')) && i < buf.length; i++) {
    eventName += iChar;
  }

  // handle binary data
  var binaryData = buf.slice(i+1, buf.length);

  var packetData = [eventName, binaryData];
  p.data = packetData;

  debug('decoded binary with event name: %s', p.data[0]);
  return p;
};

function error(data){
  return {
    type: exports.ERROR,
    data: 'parser error'
  };
}
