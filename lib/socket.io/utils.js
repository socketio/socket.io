
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
 * Frame sequence.
 */

var frame = '~m~';

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
    ret += frame + message.length + frame + message;
  }

  return ret;
};

exports.decode = function(data){
  var messages = [], number, n;
  do {
    if (data.substr(0, 3) !== frame) return messages;
    data = data.substr(3);
    number = '', n = '';
    for (var i = 0, l = data.length; i < l; i++){
      n = Number(data.substr(i, 1));
      if (data.substr(i, 1) == n){
        number += n;
      } else {  
        data = data.substr(number.length + frame.length)
        number = Number(number);
        break;
      } 
    }
    messages.push(data.substr(0, number)); // here
    data = data.substr(number);
  } while(data !== '');
  return messages;
};