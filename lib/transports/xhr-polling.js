
/**
 * socket.io
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

(function (exports, io) {

  /**
   * Expose constructor.
   */

  exports['xhr-polling'] = XHRPolling;

  /**
   * The XHR-polling transport uses long polling XHR requests to create a
   * "persistent" connection with the server.
   *
   * @constructor
   * @api public
   */

  function XHRPolling () {
    io.Transport.XHR.apply(this, arguments);
    // The transport type, you use this to identify which transport was chosen.
    this.name = 'xhr-polling';
  };

  /**
   * Inherits from XHR transport.
   */

  io.util.inherit(XHRPolling, io.Transport.XHR);

  /** 
   * Establish a connection, for iPhone and Android this will be done once the page
   * is loaded.
   *
   * @returns {Transport} Chaining.
   * @api public
   */

  XHRPolling.prototype.open = function () {
    var self = this;

    io.util.defer(function () {
      io.Transport.XHR.prototype.open.call(self);
    });

    return false;
  };

  /**
   * Starts a XHR request to wait for incoming messages.
   *
   * @api private
   */

  function empty () {};

  XHRPolling.prototype.get = function () {
    var self = this;

    function stateChange () {
      if (self.xhr.readyState == 4) {
        self.xhr.onreadystatechange = self.xhr.onload = empty;

        if (self.xhr.status == 200) {
          self.onData(self.xhr.responseText);
          self.get();
        } else {
          self.onClose();
        }
      }
    }

    this.xhr = this.request();

    if (window.XDomainRequest && this.xhr instanceof XDomainRequest) {
      this.xhr.onload = stateChange;
      this.xhr.onerror = function (e) { self.onError(e); };
    } else {
      this.xhr.onreadystatechange = stateChange;
    }

    this.xhr.send(null);
  };

})(
    'undefined' != typeof io ? io.Transport : module.exports
  , 'undefined' != typeof io ? io : module.parent.exports
);
