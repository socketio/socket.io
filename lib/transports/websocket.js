
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

  WS.prototype.open = function(){
    this.websocket = new WebSocket(this.prepareUrl());

    var self = this;
    this.websocket.onopen = function () { self.onOpen(); };
    this.websocket.onmessage = function (ev) { self.onData(ev.data); };
    this.websocket.onclose = function () { self.onClose(); };
    this.websocket.onerror = function (e) { self.onError(e); };

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
    this.websocket.send(data);
    return this;
  };

  /**
   * Disconnect the established `WebSocket` connection.
   *
   * @returns {Transport}
   * @api public
   */

  WS.prototype.close = function(){
    this.websocket.close();
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
   * Generates a connection url based on the Socket.IO URL Protocol.
   * See <https://github.com/learnboost/socket.io-node/> for more details.
   *
   * @returns {String} Connection url
   * @api private
   */

  WS.prototype.prepareUrl = function () {
    return this.scheme() + '://'
      + this.socket.options.host + ':' + this.socket.options.port + '/'
      + this.socket.options.resource + '/' + io.protocol
      + '/' + this.name + '/' + this.sessid;
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

  /**
   * Add the transport to your public io.transports array.
   *
   * @api private
   */

  io.transports.push('websocket');

})(
    'undefined' != typeof io ? io.Transport : module.exports
  , 'undefined' != typeof io ? io : module.parent.exports
);
