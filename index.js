
/**
 * Module dependencies.
 */

var debug = require('debug')('socket.io-parser');
var json = require('json3');
var msgpack = require('msgpack-js');
var isArray = require('isarray');
var base64 = require('base64-js');


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
  if (!pendingBlobs) {
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
  if ('string' == typeof obj) {
    return decodeString(obj);
  }
  else if (Buffer.isBuffer(obj) ||
          (global.ArrayBuffer && obj instanceof ArrayBuffer) ||
          (global.Blob && obj instanceof Blob)) {
    return decodeBuffer(obj);
  }
  else if (obj.base64) {
    return decodeBase64(obj.data);
  }
  else {
    throw new Error('Unknown type: ' + obj);
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
 * Decode binary data packet into JSON packet
 *
 * @param {Buffer | ArrayBuffer | Blob} buf
 * @return {Object} packet
 * @api private
 */

function decodeBuffer(buf) {
  return msgpack.decode(buf);
};

/**
 * Decode base64 msgpack string into a packet
 *
 * @param {String} b64
 * @return {Object} packet
 * @api private
 */

var NSP_SEP = 163;
var EVENT_SEP = 146;
var EVENT_STOP = 216;

function decodeBase64(b64) {
  var packet = {type: exports.BINARY_EVENT};
  var bytes = base64.toByteArray(b64);

  var nsp = '';
  var eventName = '';
  var data = [];
  var currentThing;

  for (var i = 0; i < bytes.length; i++) {
    var b = bytes[i];
    if (!currentThing) {
      if (b == EVENT_SEP && !eventName) {
        currentThing = 'ev';
        i += 1; // skip the next thing which is another seperator
      }
    }
    else if (currentThing == 'nsp') {
      nsp += String.fromCharCode(b);
    }
    else if (currentThing == 'ev') {
      if (b != EVENT_STOP) {
        eventName += String.fromCharCode(b);
      } else {
        currentThing = 'data';
        i += 2; // next two bytes are 0 and another seperator
      }
    }
    else if (currentThing == 'data') {
      if (b != NSP_SEP) {
        data.push(b);
      } else {
        currentThing = 'nsp';
        i += 4; // next three chars are 'nsp', then another seperator
      }
    }
  }

  packet.nsp = nsp;
  packet.data = [eventName, {base64: true, data: base64.fromByteArray(data)}];
  return packet;
};

function error(data){
  return {
    type: exports.ERROR,
    data: 'parser error'
  };
}
