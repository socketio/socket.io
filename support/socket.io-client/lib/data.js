/**
 * Socket.IO client
 * 
 * @author Guillermo Rauch <guillermo@learnboost.com>
 * @license The MIT license.
 * @copyright Copyright (c) 2010 LearnBoost <dev@learnboost.com>
 */

io.data = {};

/**
 * Data decoder class
 *
 * @api public
 */

io.data.Decoder = function(){
  this.reset();
  this.buffer = '';
  this.events = {};
};

io.data.Decoder.prototype = {

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
   * @param {String} reason to report
   * @api private
   */

  error: function(reason){
    this.reset();
    this.emit('error', reason);
  },

  /**
   * Emits an event
   *
   * @param {String} ev name
   * @api public
   */

  emit: function(ev){
    if (!(ev in this.events))
      return this;
    for (var i = 0, l = this.events[ev].length; i < l; i++)
      if (this.events[ev][i])
        this.events[ev][i].apply(this, Array.prototype.slice.call(arguments).slice(1));
    return this;
  },

  /**
   * Adds an event listener
   *
   * @param {String} ev name
   * @param {Function} callback
   * @api public
   */

  on: function(ev, fn){
    if (!(ev in this.events))
      this.events[ev] = [];
    this.events[ev].push(fn);
    return this;
  },

  /**
   * Removes an event listener
   *
   * @param {String} ev name
   * @param {Function} callback
   * @api public
   */

  removeListener: function(ev, fn){
    if (!(ev in this.events))
      return this;
    for (var i = 0, l = this.events[ev].length; i < l; i++)
      if (this.events[ev][i] == fn)
        this.events[ev].splice(i, 1);
    return this;
  }

};

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

io.data.encode = function(messages){
  messages = io.util.isArray(messages[0]) ? messages : [messages];
  var ret = '';
  for (var i = 0, str; i < messages.length; i++){
   str = String(messages[i][1]);
   if (str === undefined || str === null) str = '';
   ret += messages[i][0] + ':' + str.length + ':' + str + ',';
  }
  return ret;
};

/**
 * Encode message function
 *
 * @param {String} message
 * @param {Object} annotations
 * @api public
 */

io.data.encodeMessage = function(msg, annotations){
  var data = ''
    , anns = annotations || {};
  for (var k in anns){
    v = anns[k];
    data += k + (v !== null && v !== undefined ? ':' + v : '') + "\n";
  }
  data += ':' + (msg === undefined || msg === null ? '' : msg);
  return data;
};

/**
 * Decode message function
 *
 * @param {String} message
 * @api public
 */

io.data.decodeMessage = function(msg){
  var anns = {}
    , data;
  for (var i = 0, chr, key, value, l = msg.length; i < l; i++){
    chr = msg[i];
    if (i === 0 && chr === ':'){
      data = msg.substr(1);
      break;
    }
    if (key == null && value == null && chr == ':'){
      data = msg.substr(i + 1);
      break;
    }
    if (chr === "\n"){
      anns[key] = value;
      key = value = undefined;
      continue;
    }
    if (key === undefined){
      key = chr;
      continue;
    }
    if (value === undefined && chr == ':'){
      value = '';
      continue;
    }
    if (value !== undefined)
      value += chr;
    else
      key += chr;
  }
  return [data, anns];
};
