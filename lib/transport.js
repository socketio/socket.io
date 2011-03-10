/*!
 * socket.io-node-client
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

(function(){
  /**
   * @namespace
   */
  var io = this.io,
  
  /**
   * Message frame for encoding and decoding responses.
   *
   * @const
   * @type {String}
   */
  frame = '~m~',
  
  /**
   * Transforms the message to a string.
   *
   * @param {String|Array|Object} message The messages that needs to be transformed to a string.
   * @throws {Error} When a JSON.stringify implementation is missing.
   * @returns {String} Message.
   * @api private
   */
  stringify = function(message){
    if (Object.prototype.toString.call(message) == '[object Object]'){
      if (!('JSON' in window)){
        var error = 'Socket.IO Error: Trying to encode as JSON, but JSON.stringify is missing.';
        if ('console' in window && console.error){
          console.error(error);
        } else {
          throw new Error(error);
        }
        return '{ "$error": "'+ error +'" }';
      }
      return '~j~' + JSON.stringify(message);
    } else {
      return String(message);
    }
  },
  
  /**
   * The transport template for the supported tranports.
   *
   * Options:
   *   - `timeout`  Transport shutdown timeout in milliseconds, based on the heartbeat interval.
   *
   * @constructor
   * @exports Transport as io.Transport
   * @param {Object} base The reference to io.Socket.
   * @param {Object} options The transport options.
   * @property {io.Socket|Object} base The reference to io.Socket.
   * @property {Object} options The transport options, these are used to overwrite the default options
   * @property {String} sessionid The sessionid of the established connection, this is only available a connection is established
   * @property {Boolean} connected The connection has been established.
   * @property {Boolean} connecting We are still connecting to the server.
   * @api public
   */
  Transport = io.Transport = function(base, options){
    this.base = base;
    this.options = {
      timeout: 15000 // based on heartbeat interval default
    };
    io.util.merge(this.options, options);
  };

  /**
   * Sends the messages to the server using a established connection.
   *
   * @throws {Error} If not overwritten.
   * @api public
   */
  Transport.prototype.send = function(){
    throw new Error('Missing send() implementation');
  };
  
  /**
   * Establish a connection with the server.
   *
   * @throws {Error} If not overwritten.
   * @api public
   */
  Transport.prototype.connect = function(){
    throw new Error('Missing connect() implementation');
  };

  /**
   * Disconnect the established connection.
   *
   * @throws {Error} If not overwritten.
   * @api private
   */
  Transport.prototype.disconnect = function(){
    throw new Error('Missing disconnect() implementation');
  };
  
  /**
   * Encodes messages to the Socket.io protocol.
   *
   * @param {String|Array} messages Messages that need to be encoded.
   * @returns {String} Encoded message.
   * @api private
   */
  Transport.prototype.encode = function(messages){
    var ret = '', message;
    messages = io.util.isArray(messages) ? messages : [messages];
    for (var i = 0, l = messages.length; i < l; i++){
      message = messages[i] === null || messages[i] === undefined ? '' : stringify(messages[i]);
      ret += frame + message.length + frame + message;
    }
    return ret;
  };
  
  /**
   * Decodes the Socket.io protocol to a JavaScript response.
   *
   * @param (String} data The response from the server that requires decoding
   * @returns {Array} Decoded messages.
   * @api private
   */
  Transport.prototype.decode = function(data){
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
          data = data.substr(number.length + frame.length);
          number = Number(number);
          break;
        }
      }
      messages.push(data.substr(0, number)); // here
      data = data.substr(number);
    } while(data !== '');
    return messages;
  };
  
  /**
   * Handles the responses from the server. When a response is received
   * it will automatically update the timeout, decode the message and
   * forwards the response to the onMessage function for further processing.
   *
   * @param {String} data Response from the server.
   * @api private
   */
  Transport.prototype.onData = function(data){
    this.setTimeout();
    var msgs = this.decode(data);
    if (msgs && msgs.length){
      for (var i = 0, l = msgs.length; i < l; i++){
        this.onMessage(msgs[i]);
      }
    }
  };
  
  /**
   * Clears the existing timeout timer and updates it with a
   * fresh connection timeout timer.
   *
   * @api private
   */
  Transport.prototype.setTimeout = function(){
    var self = this;
    if (this.timeout) clearTimeout(this.timeout);
    this.timeout = setTimeout(function(){
      self.onTimeout();
    }, this.options.timeout);
  };
  
  /**
   * When a connection times out, we will disconnect.
   * 
   * @api private
   */
  Transport.prototype.onTimeout = function(){
    this.onDisconnect();
  };
  
  /**
   * When a decoded message has been received we process it's
   * contents further before we dispatch it. When there isn't a
   * sessionid set, we assume that received messages is the sessionid.
   * If a message is prefixed with `~h~` we will dispatch it to our
   * heartbeat method andif the message is prefixed with `~j~` we need
   * transform the contents of the message to a JSON Object.
   *
   * @param {String} message A decoded message from the server.
   * @api private
   */
  Transport.prototype.onMessage = function(message){
    if (!this.sessionid){
      this.sessionid = message;
      this.onConnect();
    } else if (message.substr(0, 3) == '~h~'){
      this.onHeartbeat(message.substr(3));
    } else if (message.substr(0, 3) == '~j~'){
      this.base.onMessage(JSON.parse(message.substr(3)));
    } else {
      this.base.onMessage(message);
    }
  },
  
  /**
   * Sends the received heartbeat message back to server.
   *
   * @param {String} heartbeat Heartbeat response from the server.
   * @api private
   */
  Transport.prototype.onHeartbeat = function(heartbeat){
    this.send('~h~' + heartbeat); // echo
  };
  
  /**
   * Notifies the base on connect.
   *
   * @api private
   */
  Transport.prototype.onConnect = function(){
    this.connected = true;
    this.connecting = false;
    this.base.onConnect();
    this.setTimeout();
  };
  
  /**
   * Notifies the base on disconnect.
   *
   * @api private
   */
  Transport.prototype.onDisconnect = function(){
    this.connecting = false;
    this.connected = false;
    this.sessionid = null;
    this.base.onDisconnect();
  };
  
  /**
   * Generates a connection url based on the Socket.io Protocol.
   *
   * @returns {String} Connection url
   * @api private
   */
  Transport.prototype.prepareUrl = function(){
    return (this.base.options.secure ? 'https' : 'http') 
      + '://' + this.base.host 
      + ':' + this.base.options.port
      + '/' + this.base.options.resource
      + '/' + this.type
      + (this.sessionid ? ('/' + this.sessionid) : '/');
  };

})();