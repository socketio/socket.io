/**
 * Module dependencies
 */

var EventEmitter = require('events').EventEmitter;

/**
 * Data decoder class
 *
 * @api public
 */

function Decoder(){
  this.reset();
  this.buffer = '';
}

Decoder.prototype = {

  /**
   * Add data to the buffer for parsing
   *
   * @param {String} data
   * @api public
   */
  add: function(data){
    this.buffer += data;
    this.parse();
  },

  /**
   * Parse the current buffer
   *
   * @api private
   */
  parse: function(){
    for (var l = this.buffer.length; this.i < l; this.i++){
      var chr = this.buffer[this.i];
      if (this.type === undefined){
        if (chr == ':') return this.error('Data type not specified');
        this.type = '' + chr;
        continue;
      }
      if (this.length === undefined && chr == ':'){
        this.length = '';
        continue;
      }
      if (this.data === undefined){
        if (chr != ':'){
          this.length += chr;
        } else { 
          if (this.length.length === 0)
            return this.error('Data length not specified');
          this.length = Number(this.length);
          this.data = '';
        }
        continue;
      }
      if (this.data.length === this.length){
        if (chr == ','){
          this.emit('data', this.type, this.data);
          this.buffer = this.buffer.substr(this.i + 1);
          this.reset();
          return this.parse();
        } else {
          return this.error('Termination character "," expected');
        }
      } else {
        this.data += chr;
      }
    }
  },

  /**
   * Reset the parser state
   *
   * @api private
   */

  reset: function(){
    this.i = 0;
    this.type = this.data = this.length = undefined;
  },

  /**
   * Error handling functions
   *
   * @api private
   */

  error: function(reason){
    this.reset();
    this.emit('error', reason);
  }

};

/**
 * Inherit from EventEmitter
 */

Decoder.prototype.__proto__ = EventEmitter.prototype;

/**
 * Encode function
 * 
 * Examples:
 *      encode([3, 'Message of type 3']);
 *      encode([[1, 'Message of type 1], [2, 'Message of type 2]]);
 * 
 * @param {Array} list of messages
 * @api public
 */

function encode(messages){
  messages = Array.isArray(messages[0]) ? messages : [messages];
  var ret = '';
  for (var i = 0, str; i < messages.length; i++){
   str = messages[i][1];
   if (str === undefined || str === null) str = '';
   ret += messages[i][0] + ':' + str.length + ':' + str + ',';
  }
  return ret;
}

/**
 * Encode message function
 *
 * @param {String} message
 * @param {Object} annotations
 * @api public
 */

function encodeMessage(msg, annotations){
  var data = ''
    , anns = annotations || {};
  for (var i = 0, v, k = Object.keys(anns), l = k.length; i < l; i++){
    v = anns[k[i]];
    data += k[i] + (v !== null && v !== undefined ? ':' + v : '') + "\n";
  }
  data += ':' + (msg === undefined || msg === null ? '' : msg);
  return data;
}

/**
 * Decode message function
 *
 * @param {String} message
 * @api public
 */

function decodeMessage(msg){
  var anns = {}
    , data;
  for (var i = 0, chr, key, value, l = msg.length; i < l; i++){
    chr = msg[i];
    if (i === 0 && chr === ':'){
      data = msg.substr(1);
      break;
    }
    if (key == null && value == null && chr == ':'){
      data  = msg.substr(i + 1);
      break;
    }
  }
  return [data, anns];
}

/**
 * Export APIs
 */

exports.Decoder = Decoder;
exports.encode = encode;
exports.encodeMessage = encodeMessage;
exports.decodeMessage = decodeMessage;
