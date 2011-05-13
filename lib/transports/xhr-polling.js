/**
 * socket.io-node-client
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

(function(){
  var io = this.io,
  
  /**
   * A small stub function that will be used to reduce memory leaks.
   *
   * @type {Function}
   * @api private
   */
  empty = new Function(),
  
  /**
   * The XHR-polling transport uses long polling XHR requests to create a
   * "persistent" connection with the server.
   *
   * @constructor
   * @extends {io.Transport.XHR}
   * @api public
   */
  XHRPolling = io.Transport['xhr-polling'] = function(){
    io.Transport.XHR.apply(this, arguments);
  };
  
  io.util.inherit(XHRPolling, io.Transport.XHR);
  
  /**
   * The transport type, you use this to identify which transport was chosen.
   *
   * @type {string}
   * @api public
   */
  XHRPolling.prototype.type = 'xhr-polling';
  
  /** 
   * Establish a connection, for iPhone and Android this will be done once the page
   * is loaded.
   *
   * @returns {Transport} Chaining.
   * @api public
   */
  XHRPolling.prototype.connect = function(){
    var self = this;
    io.util.defer(function(){ io.Transport.XHR.prototype.connect.call(self) });
    return false;
  };
  
   /**
   * Starts a XHR request to wait for incoming messages.
   *
   * @api private
   */
  XHRPolling.prototype.get = function(){
    var self = this;
    this.xhr = this.request(+ new Date, 'GET');
    this.xhr.onreadystatechange = function(){
      var status;
      if (self.xhr.readyState == 4){
        self.xhr.onreadystatechange = empty;
        try { status = self.xhr.status; } catch(e){}
        if (status == 200){
          self.onData(self.xhr.responseText);
          self.get();
        } else {
          self.onDisconnect();
        }
      }
    };
    this.xhr.send(null);
  };
  
  /**
   * Checks if browser supports this transport.
   *
   * @return {Boolean}
   * @api public
   */
  XHRPolling.check = function(){
    return io.Transport.XHR.check();
  };
  
  /**
   * Check if cross domain requests are supported
   *
   * @returns {Boolean}
   * @api public
   */
  XHRPolling.xdomainCheck = function(){
    return io.Transport.XHR.xdomainCheck();
  };

})();
