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
   * @extends {io.Transport.websocket}
   * @api public
   */
  Flashsocket = io.Transport.flashsocket = function(){
    io.Transport.websocket.apply(this, arguments);
  };
  
  io.util.inherit(Flashsocket, io.Transport.websocket);
  
  /**
   * The transport type, you use this to identify which transport was chosen.
   *
   * @type {String}
   * @api public
   */
  Flashsocket.prototype.type = 'flashsocket';
  
  /**
   * Creates a connection to the server by adding new task to the WebSocket polyfill.
   *
   * @returns {Transport} Chaining.
   * @api public
   */
  Flashsocket.prototype.connect = function(){
    var self = this, args = arguments;
    WebSocket.__addTask(function(){
      io.Transport.websocket.prototype.connect.apply(self, args);
    });
    return this;
  };
  
  /**
   * Sends the message to the transport
   *
   * @returns {Transport} Chaining.
   * @api public
   */
  Flashsocket.prototype.send = function(){
    var self = this, args = arguments;
    WebSocket.__addTask(function(){
      io.Transport.websocket.prototype.send.apply(self, args);
    });
    return this;
  };
  
  /**
   * Check if the WebSocket polyfill is correctly loaded and if browser
   * has the correct FlashPlayer version (10.0.0) installed.
   *
   * @returns {Boolean}
   * @api public
   */
  Flashsocket.check = function(){
    if (typeof WebSocket == 'undefined' || !('__addTask' in WebSocket) || !swfobject) return false;
    return swfobject.hasFlashPlayerVersion("10.0.0");
  };
  
  /**
   * Checks if Flashsocket transport can be used as a cross domain / cross origin transport.
   *
   * @returns {Boolean}
   * @api public
   */
  Flashsocket.xdomainCheck = function(){
    return true;
  };
  
})();