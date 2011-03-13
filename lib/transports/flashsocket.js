/**
 * socket.io-node-client
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

(function(){
  var io = this.io,
  
  /**
   * The Flashsocket transport. This is a API wrapper for the HTML5 WebSocket specification.
   * It uses a .swf file to communicate with the server. If you want to serve the .swf file
   * from a other server than where the Socket.IO script is coming from you need to use the
   * insecure version of the .swf. More information about this can be found on the github page.
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
   * Disconnect the established `Flashsocket` connection. This is done by adding a new
   * task to the Flashsocket. The rest will be handled off by the `WebSocket` transport.
   *
   * @returns {Transport}
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
   * Sends a message to the Socket.IO server. This is done by adding a new
   * task to the Flashsocket. The rest will be handled off by the `WebSocket` transport.
   *
   * @returns {Transport}
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
   * Check if the Flashsocket transport is supported as it requires that the Adobe Flash Player
   * plugin version `10.0.0` or greater is installed. And also check if the polyfill is correctly
   * loaded.
   *
   * @returns {Boolean}
   * @api public
   */
  Flashsocket.check = function(){
    if (typeof WebSocket == 'undefined' || !('__addTask' in WebSocket) || !swfobject) return false;
    return swfobject.hasFlashPlayerVersion("10.0.0");
  };
  
  /**
   * Check if the Flashsocket transport can be used as cross domain / cross origin transport.
   * Because we can't see which type (secure or insecure) of .swf is used we will just return true.
   *
   * @returns {Boolean}
   * @api public
   */
  Flashsocket.xdomainCheck = function(){
    return true;
  };
  
})();