/**
 * Modle requirements
 */

var isArray = require('isarray');

/**
 * Replaces every Buffer | ArrayBuffer in packet with a numbered placeholder.
 * Anything with blobs or files should be fed through removeBlobs before coming
 * here.
 *
 * @param {Object} packet - socket.io event packet
 * @return {Object} with deconstructed packet and list of buffers
 * @api public
 */

exports.deconstructPacket = function(packet) {
    var buffers = [];
    var packetData = packet.data;

    function deconstructBinPackRecursive(data) {
        if (!data) return data;

        if ((global.Buffer && Buffer.isBuffer(data)) ||
            (global.ArrayBuffer && data instanceof ArrayBuffer)) { // replace binary
            var placeholder = {_placeholder: true, num: buffers.length};
            buffers.push(data);
            return placeholder;
        } else if (isArray(data)) {
            var newData = new Array(data.length);
            for (var i = 0; i < data.length; i++) {
                newData[i] = deconstructBinPackRecursive(data[i]);
            }
            return newData;
        } else if ('object' == typeof data) {
            var newData = {};
            for (var key in data) {
                newData[key] = deconstructBinPackRecursive(data[key]);
            }
            return newData;
        }
        return data;
    }

    var pack = packet;
    pack.data = deconstructBinPackRecursive(packetData);
    pack.attachments = buffers.length; // number of binary 'attachments'
    return {packet: pack, buffers: buffers};
}

/**
 * Reconstructs a binary packet from its placeholder packet and buffers
 *
 * @param {Object} packet - event packet with placeholders
 * @param {Array} buffers - binary buffers to put in placeholder positions
 * @return {Object} reconstructed packet
 * @api public
 */

 exports.reconstructPacket = function(packet, buffers) {
    var curPlaceHolder = 0;

    function reconstructBinPackRecursive(data) {
        if (data._placeholder) {
            var buf = buffers[data.num]; // appropriate buffer (should be natural order anyway)
            return buf;
        } else if (isArray(data)) {
            for (var i = 0; i < data.length; i++) {
                data[i] = reconstructBinPackRecursive(data[i]);
            }
            return data;
        } else if ('object' == typeof data) {
            for (var key in data) {
                data[key] = reconstructBinPackRecursive(data[key]);
            }
            return data;
        }
        return data;
    }

    packet.data = reconstructBinPackRecursive(packet.data);
    packet.attachments = undefined; // no longer useful
    return packet;
 }

/**
 * Asynchronously removes Blobs or Files from data via
 * FileReader's readAsArrayBuffer method. Used before encoding
 * data as msgpack. Calls callback with the blobless data.
 *
 * @param {Object} data
 * @param {Function} callback
 * @api private
 */

exports.removeBlobs = function(data, callback) {

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
          callback(bloblessData);
        }
      };

      fileReader.readAsArrayBuffer(obj); // blob -> arraybuffer
    }

    if (isArray(obj)) { // handle array
      for (var i = 0; i < obj.length; i++) {
        removeBlobsRecursive(obj[i], i, obj);
      }
    } else if (obj && 'object' == typeof obj && !isBuf(obj)) { // and object
      for (var key in obj) {
        removeBlobsRecursive(obj[key], key, obj);
      }
    }
  }

  var pendingBlobs = 0;
  var bloblessData = data;
  removeBlobsRecursive(bloblessData);
  if (!pendingBlobs) {
    callback(bloblessData);
  }
}

/**
 * Returns true if obj is a buffer or an arraybuffer.
 *
 * @api private
 */
function isBuf(obj) {
  return (global.Buffer && Buffer.isBuffer(obj)) ||
         (global.ArrayBuffer && obj instanceof ArrayBuffer);
}
