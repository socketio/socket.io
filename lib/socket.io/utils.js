
/*!
 * Socket.IO - utils
 * Copyright (c) 2010-2011 Guillermo Rauch <guillermo@learnboost.com>
 * MIT Licensed
 */

/**
 * Object#toString.
 */

var toString = Object.prototype.toString

/**
 * Frame marker.
 */

var marker = '~m~'
  , markerLength = marker.length;

/**
 * Merge `src` into `dest`.
 *
 * @param {Object} dest
 * @param {Object} src
 * @return {Object} dest
 * @api private
 */

exports.merge = function(dest, src){
  for (var k in src) dest[k] = src[k];
  return dest;
};

/**
 * Stringify the given `message`. when an object
 * is given it will be converted to JSON.
 *
 * @param {String|Object} message
 * @return {String}
 * @api private
 */

function stringify(message){
  if ('[object Object]' == toString.call(message)){
    return '~j~' + JSON.stringify(message);
  } else {
    return String(message);
  }
};

/**
 * Encode the given `messages`, framed as 
 *
 *      <marker> <len> <marker> <data>
 *
 * @param {String|Array} messages
 * @return {String}
 * @api private
 */

exports.encode = function(messages){
  var messages = Array.isArray(messages) ? messages : [messages]
    , len = messages.length
    , ret = ''
    , message;

  for (var i = 0; i < len; ++i){
    message = null == messages[i] ? '' : stringify(messages[i]);
    ret += marker + message.length + marker + message;
  }

  return ret;
};

/**
 * Decode `data`.
 *
 * @param {String} data
 * @return {Array}
 * @api private
 */

exports.decode = function(data){
  var messages = []
    , len = data.length
    , bytes;

  for (var i = 0; i < len; ++i) {
    // <marker<> <len> <marker>
    if (i == data.indexOf(marker, i)) {
      i += markerLength;
      bytes = data.substring(i, data.indexOf(marker, i));
      i += bytes.length + markerLength;
      if (isNaN(bytes)) continue;

      // <data>
      bytes = parseInt(bytes, 10);
      messages.push(data.substr(i, bytes))
      i += bytes - 1;
    }
  }

  return messages;
};