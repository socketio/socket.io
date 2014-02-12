
/**
 * Module dependencies.
 */

var debug = require('debug')('socket.io-parser');
var json = require('json3');
if (!global.document) { var msgpack = require('msgpack-js'); } // in node
else { var msgpack = require('msgpack-js-browser'); } // in browswer
var isArray = require('isarray');


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

exports.encode = function(obj, callback){
  debug('encoding packet %j', obj);
  if (obj.type === exports.BINARY_EVENT) {
    encodeAsBinary(obj, callback);
  }
  else {
    var encoding = encodeAsString(obj);
    callback(encoding);
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

function encodeAsBinary(obj, callback) {
  if (global.Blob || global.File) {
    removeBlobs(obj, callback);
  } else {
    var encoding = msgpack.encode(obj);
    callback(encoding);
  }
}

/**
 * Asynchronously removes Blobs or Files from data via
 * FileReaders readAsArrayBuffer method. Used before encoding
 * data as msgpack. Calls callback with the blobless data.
 *
 * @param {Object} data
 * @param {Function} callback
 * @api private
 */

function removeBlobs(data, callback) {

  function removeBlobsRecursive(obj, curKey, containingObject) {
    if (!obj) return obj;

    // convert any blob
    if ((global.Blob && obj instanceof Blob) ||
        (global.File && obj instanceof File)) {
      pendingBlobs++;

      // async filereader
      var fileReader = new FileReader();
      fileReader.onload = function() { // this.result == arraybuffer
        if (containingObject) {
          containingObject[curKey] = this.result;
        }
        else {
          bloblessData = this.result;
        }

        // if nothing pending its callback time
        if(! --pendingBlobs) {
          callback(msgpack.encode(bloblessData));
        }
      };

      fileReader.readAsArrayBuffer(obj); // blob -> arraybuffer
    }

    // handle array
    if (isArray(obj)) {
      for (var i = 0; i < obj.length; i++) {
        removeBlobsRecursive(obj[i], i, obj);
      }
    } else if (obj && 'object' == typeof obj) { // and object
      for (var key in obj) {
        removeBlobsRecursive(obj[key], key, obj);
      }
    }
  }

  var pendingBlobs = 0;
  var bloblessData = data;
  removeBlobsRecursive(bloblessData);
  if (!pendingBlobs)  {
    callback(msgpack.encode(bloblessData));
  }
}

/**
 * Decodes a packet Object (msgpack or string) into
 * packet JSON.
 *
 * @param {Object} obj
 * @return {Object} packet
 * @api public
 */

exports.decode = function(obj) {
  if ('string' === typeof obj) {
    return decodeString(obj);
  }
  else if (Buffer.isBuffer(obj)) {
    return decodeBuffer(obj);
  }
  else if (global.ArrayBuffer && obj instanceof ArrayBuffer) {
    return decodeArrayBuffer(obj);
  }
  else if (global.Blob && obj instanceof Blob) {
    return decodeBlob(obj);
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
  return msgpack.decode(buf);
};

/**
 * Decode a packet ArrayBuffer (binary data)
 *
 * @param {ArrayBuffer} buf
 * @return {Object} packet
 * @api private
 */

function decodeArrayBuffer(buf) {
  return msgpack.decode(buf);
};

/**
 * Decode a packet Blob (binary data)
 *
 * @param {Blob} buf
 * @return {Object} packet
 * @api private
 */

function decodeBlob(blob) {
  return msgpack.decode(buf);
};

function error(data){
  return {
    type: exports.ERROR,
    data: 'parser error'
  };
}
