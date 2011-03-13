/**
 * socket.io-node-client
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

(function(){
  var io = this.io,
  
  /**
   * The WebSocket transport uses the HTML5 WebSocket API to establish an persistent
   * connection with the Socket.IO server. This transport will also be inherited by the
   * FlashSocket fallback as it provides a API compatible polyfill for the WebSockets.
   *
   * @constructor
   * @extends {io.Transport}
   * @api public
   */
  WS = io.Transport.websocket = function(){
    io.Transport.apply(this, arguments);
  };
  
  io.util.inherit(WS, io.Transport);
  
  /**
   * The transport type, you use this to identify which transport was chosen.
   *
   * @type {String}
   * @api public
   */
  WS.prototype.type = 'websocket';
  
  /**
   * Initializes a new `WebSocket` connection with the Socket.IO server. We attach
   * all the appropriate listeners to handle the responses from the server.
   *
   * @returns {Transport}
   * @api public
   */
  WS.prototype.connect = function(){
    var self = this;
    this.socket = new WebSocket(this.prepareUrl());
    this.socket.onmessage = function(ev){ self.onData(ev.data); };
    this.socket.onclose = function(ev){ self.onDisconnect(); };
    this.socket.onerror = function(e){ self.onError(e); };
    return this;
  };
  
  /**
   * Send a message to the Socket.IO server. The message will automatically be encoded
   * in the correct message format.
   *
   * @returns {Transport}
   * @api public
   */
  WS.prototype.send = function(data){
    if (this.socket) this.socket.send(this.encode(data));
    return this;
  };
  
  /**
   * Disconnect the established `WebSocket` connection.
   *
   * @returns {Transport}
   * @api public
   */
  WS.prototype.disconnect = function(){
    if (this.socket) this.socket.close();
    return this;
  };
  
  /**
   * Handle the errors that `WebSocket` might be giving when we
   * are attempting to connect or send messages.
   *
   * @param {Error} e The error.
   * @api private
   */
  WS.prototype.onError = function(e){
    this.base.emit('error', [e]);
  };
  
  /**
   * Generate a `WebSocket` compatible URL based on the options
   * the user supplied in our Socket.IO base.
   *
   * @returns {String} Connection url
   * @api private
   */
  WS.prototype.prepareUrl = function(){
    return (this.base.options.secure ? 'wss' : 'ws') 
    + '://' + this.base.host 
    + ':' + this.base.options.port
    + '/' + this.base.options.resource
    + '/' + this.type
    + (this.sessionid ? ('/' + this.sessionid) : '');
  };
  
  /**
   * Checks if the browser has support for native `WebSockets` and that
   * it's not the polyfill created for the FlashSocket transport.
   *
   * @return {Boolean}
   * @api public
   */
  WS.check = function(){
    // we make sure WebSocket is not confounded with a previously loaded flash WebSocket
    return 'WebSocket' in window && WebSocket.prototype && ( WebSocket.prototype.send && !!WebSocket.prototype.send.toString().match(/native/i)) && typeof WebSocket !== "undefined";
  };
  
  /**
   * Check if the `WebSocket` transport support cross domain communications.
   *
   * @returns {Boolean}
   * @api public
   */
  WS.xdomainCheck = function(){
    return true;
  };
  
})();
