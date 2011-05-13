/**
 * socket.io-node-client
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

(function(){
  var io = this.io,
  
  /**
   * Message frame for encoding and decoding responses from the Socket.IO server.
   *
   * @const
   * @type {String}
   */
  frame = '~m~',
  
  /**
   * Transforms the message to a string. If the message is an {Object} we will convert it to
   * a string and prefix it with the `~j~` flag to indicate that message is JSON encoded.
   *
   * Example:
   *
   *     stringify({foo:"bar"});
   *     // => "~j~{"foo":"bar"}"
   *
   * @param {String|Array|Object} message The messages that needs to be transformed to a string.
   * @throws {Error} When the JSON.stringify implementation is missing in the browser.
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
   * This is the transport template for all supported transport methods. It provides the
   * basic functionality to create a working transport for Socket.IO.
   *
   * Options:
   *   - `timeout`  Transport shutdown timeout in milliseconds, based on the heartbeat interval.
   *
   * Example:
   *
   *     var transport = io.Transport.mytransport = function(){
   *       io.Transport.apply(this, arguments);
   *     };
   *     io.util.inherit(transport, io.Transport);
   *     
   *     ... // more code here
   *     
   *     // connect with your new transport
   *     var socket = new io.Socket(null,{transports:['mytransport']});
   *
   * @constructor
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
   * Send the message to the connected Socket.IO server.
   *
   * @throws {Error} When the io.Transport is inherited, it should override this method.
   * @api public
   */
  Transport.prototype.send = function(){
    throw new Error('Missing send() implementation');
  };
  
  /**
   * Establish a connection with the Socket.IO server..
   *
   * @throws {Error} When the io.Transport is inherited, it should override this method.
   * @api public
   */
  Transport.prototype.connect = function(){
    throw new Error('Missing connect() implementation');
  };

  /**
   * Disconnect the established connection.
   *
   * @throws {Error} When the io.Transport is inherited, it should override this method.
   * @api private
   */
  Transport.prototype.disconnect = function(){
    throw new Error('Missing disconnect() implementation');
  };
  
  /**
   * Encode the message by adding the `frame` to each message. This allows
   * the client so send multiple messages with only one request.
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
   * Decoded the response from the Socket.IO server, as the server could send multiple
   * messages in one response.
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
   * Handles the response from the server. When a new response is received
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
   * All the transports have a dedicated timeout to detect if
   * the connection is still alive. We clear the existing timer
   * and set new one each time this function is called. When the
   * timeout does occur it will call the `onTimeout` method.
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
   * Disconnect from the Socket.IO server when a timeout occurs.
   * 
   * @api private
   */
  Transport.prototype.onTimeout = function(){
    this.onDisconnect();
  };
  
  /**
   * After the response from the server has been parsed to individual
   * messages we need to decode them using the the Socket.IO message
   * protocol: <https://github.com/learnboost/socket.io-node/>.
   *
   * When a message is received we check if a session id has been set,
   * if the session id is missing we can assume that the received message
   * contains the sessionid of the connection.
   
   * When a message is prefixed with `~h~` we dispatch it our heartbeat
   * processing method `onHeartbeat` with the content of the heartbeat.
   *
   * When the message is prefixed with `~j~` we can assume that the contents
   * of the message is JSON encoded, so we parse the message and notify
   * the base of the new message.
   *
   * If none of the above, we consider it just a plain text message and
   * notify the base of the new message.
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
   * Send the received heartbeat message back to server. So the server
   * knows we are still connected.
   *
   * @param {String} heartbeat Heartbeat response from the server.
   * @api private
   */
  Transport.prototype.onHeartbeat = function(heartbeat){
    this.send('~h~' + heartbeat); // echo
  };
  
  /**
   * Notifies the base when a connection to the Socket.IO server has
   * been established. And it starts the connection `timeout` timer.
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
   * Notifies the base when the connection with the Socket.IO server
   * has been disconnected.
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
   * Generates a connection url based on the Socket.IO URL Protocol.
   * See <https://github.com/learnboost/socket.io-node/> for more details.
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