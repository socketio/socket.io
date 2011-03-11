/**
 * socket.io-node-client
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */


(function(){
  var io = this.io,
  
  /**
   * The Flashsocket transport.
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
   * Creates a connection to the Socket.IO server.
   *
   * @returns {Transport} Chaining.
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
   * Sends the message to the transport
   *
   * @returns {Transport} Chaining.
   * @api public
   */
  WS.prototype.send = function(data){
    if (this.socket) this.socket.send(this.encode(data));
    return this;
  };
  
  /**
   * Disconnect the established connection.
   *
   * @returns {Transport} Chaining.
   * @api public
   */
  WS.prototype.disconnect = function(){
    if (this.socket) this.socket.close();
    return this;
  };
  
  /**
   * Handle errors from the WebSocket connection
   *
   * @param {Error} e The error
   * @api private
   */
  WS.prototype.onError = function(e){
    this.base.emit('error', [e]);
  };
  
  /**
   * Generate a WebSocket compatible URL that is compatible
   * with the Socket.IO server protocol
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
   * Checks if browser supports this transport.
   *
   * @return {Boolean}
   * @api public
   */
  WS.check = function(){
    // we make sure WebSocket is not confounded with a previously loaded flash WebSocket
    return 'WebSocket' in window && WebSocket.prototype && ( WebSocket.prototype.send && !!WebSocket.prototype.send.toString().match(/native/i)) && typeof WebSocket !== "undefined";
  };
  
  /**
   * Check if cross domain requests are supported
   *
   * @returns {Boolean}
   * @api public
   */
  WS.xdomainCheck = function(){
    return true;
  };
  
})();
