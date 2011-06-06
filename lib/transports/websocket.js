
/**
 * socket.io
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

(function (exports, io) {

  /**
   * Expose constructor.
   */

  exports.websocket = WS;

  /**
   * The WebSocket transport uses the HTML5 WebSocket API to establish an persistent
   * connection with the Socket.IO server. This transport will also be inherited by the
   * FlashSocket fallback as it provides a API compatible polyfill for the WebSockets.
   *
   * @constructor
   * @extends {io.Transport}
   * @api public
   */

  function WS (socket) {
    io.Transport.apply(this, arguments);
    // The transport type, you use this to identify which transport was chosen.
    this.name = 'websocket';
  };

  /**
   * Inherits from Transport.
   */

  io.util.inherit(WS, io.Transport);

  /**
   * Initializes a new `WebSocket` connection with the Socket.IO server. We attach
   * all the appropriate listeners to handle the responses from the server.
   *
   * @returns {Transport}
   * @api public
   */

  WS.prototype.connect = function(){
    this.socket = new WebSocket(this.prepareUrl());

    var self = this;
    this.socket.onopen = function () { self.onOpen(); };
    this.socket.onmessage = function (ev) { self.onData(ev.data); };
    this.socket.onclose = function () { self.onClose(); };
    this.socket.onerror = function (e) { self.onError(e); };

    return this;
  };
  
  /**
   * Send a message to the Socket.IO server. The message will automatically be encoded
   * in the correct message format.
   *
   * @returns {Transport}
   * @api public
   */

  WS.prototype.send = function (data) {
    if (this.socket) {
      this.socket.send(io.encodePayload([data]));
    }

    return this;
  };

  /**
   * Disconnect the established `WebSocket` connection.
   *
   * @returns {Transport}
   * @api public
   */

  WS.prototype.close = function(){
    if (this.socket) {
      this.socket.close();
    }

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
    this.socket.onError(e);
  };

  /**
   * Returns the appropriate scheme for the URI generation.
   *
   * @api private
   */
  WS.prototype.scheme = function(){
    return (this.socket.options.secure ? 'wss' : 'ws');
  };

  /**
   * Checks if the browser has support for native `WebSockets` and that
   * it's not the polyfill created for the FlashSocket transport.
   *
   * @return {Boolean}
   * @api public
   */

  WS.check = function(){
    return !! window.WebSocket;
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

})(
    'undefined' != typeof io ? io.Transport : module.exports
  , 'undefined' != typeof io ? io : module.parent.exports
);
