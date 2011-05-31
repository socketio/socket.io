/**
 * socket.io-node-client
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

(function(){
  var io = this.io,
  
  /**
   * The Server-Sent Events transport uses an EventSource object to
   * stream in the data from the Socket.IO server
   *
   * @constructor
   * @extends {io.Transport.XHR}
   * @api public
   */
  SSE = io.Transport['sse'] = function(){
    io.Transport.XHR.apply(this, arguments);
  };
  
  io.util.inherit(SSE, io.Transport.XHR);
  
   /**
   * The transport type, you use this to identify which transport was chosen.
   *
   * @type {String}
   * @api public
   */
  SSE.prototype.type = 'sse';
  
  /**
   * Starts the multipart stream for incomming messages.
   *
   * @api private
   */
  SSE.prototype.get = function(){
    var src = new EventSource(this.prepareUrl()), self = this;
    src.onmessage = function(event){
      self.onData(event.data);
    }
  };
  
  /**
   * Checks if browser supports this transport.
   *
   * @return {Boolean}
   * @api public
   */
  SSE.check = function(){
    return !!EventSource;
  };
  
  /**
   * Check if cross domain requests are supported.
   *
   * @returns {Boolean}
   * @api public
   */
  SSE.xdomainCheck = function(){
    return true;
  };
  
})();
