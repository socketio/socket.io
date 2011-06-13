
/**
 * socket.io
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

(function (exports, io) {

  /**
   * Expose constructor.
   */

  exports.Socket = Socket;

  /**
   * Create a new `Socket.IO client` which can establish a persisent
   * connection with a Socket.IO enabled server.
   *
   * @api public
   */

  function Socket (options) {
    this.options = {
        port: 80
      , secure: false
      , document: document
      , resource: 'socket.io'
      , transports: io.transports
      , 'connect timeout': 10000
      , 'try multiple transports': true
      , 'reconnect': true
      , 'reconnection delay': 500
      , 'reopen delay': 3000
      , 'max reconnection attempts': 10
      , 'sync disconnect on unload': true
      , 'auto connect': true
    };

    io.util.merge(this.options, options);

    this.connected = false;
    this.open = false;
    this.connecting = false;
    this.reconnecting = false;

    if (this.options['sync disconnect on unload']) {
      var self = this;

      io.util.on(window, 'beforeunload', function () {
        self.disconnect(true);
      }, false);
    }

    if (this.options['auto connect']) {
      this.connect();
    }
  };

  /**
   * Apply EventEmitter mixin.
   */

  io.util.mixin(Socket, io.EventEmitter);

  /**
   * Returns a namespace listener/emitter for this socket
   *
   * @api public
   */

  Socket.prototype.of = function (name) {
    if (!this.namespaces) this.namespaces = {};
    if (!this.namespaces[name]) {
      this.namespaces[name] = new io.SocketNamespace(this, name);
    }

    return this.namespaces[name];
  };

  /**
   * Performs the handshake
   *
   * @api private
   */

  function empty () { };

  Socket.prototype.handshake = function (fn) {
    var self = this;

    function complete (data) {
      if (data instanceof Error) {
        self.onError(data.message);
      } else {
        fn.apply(null, data.split(':'));
      }
    };

    var url = this.options.resource + '/' + io.protocol + '/?t=' + (+ new Date);

    if (this.isXDomain()) {
      var insertAt = document.getElementsByTagName('script')[0]
        , script = document.createElement('SCRIPT');

      script.src = url + '&jsonp=' + io.j.length;
      insertAt.parentNode.insertBefore(script, insertAt);

      io.j.push(function (data) {
        complete(data);
        script.parentNode.removeChild(script);
      });
    } else {
      var xhr = io.util.request();

      xhr.open('GET', url);
      xhr.onreadystatechange = function () {
        if (xhr.readyState == 4) {
          xhr.onreadystatechange = empty;

          if (xhr.status == 200) {
            complete(xhr.responseText);
          } else {
            self.onError(xhr.responseText);
          }
        }
      };
      xhr.send(null);
    }
  };

  /**
   * Find an available transport based on the options supplied in the constructor.
   *
   * @api private
   */

  Socket.prototype.getTransport = function (override) {
    var transports = override || this.transports, match;

    for (var i = 0, transport; transport = transports[i]; i++) {
      if (io.Transport[transport]
        && io.Transport[transport].check()
        && (!this.isXDomain() || io.Transport[transport].xdomainCheck())) {
        return new io.Transport[transport](this, this.sessionid);
      }
    }

    return null;
  };

  /**
   * Connects to the server.
   *
   * @param {Function} [fn] Callback.
   * @returns {io.Socket}
   * @api public
   */

  Socket.prototype.connect = function (fn) {
    if (this.connecting) {
      return this;
    }

    var self = this;

    this.handshake(function (sid, close, heartbeat, transports) {
      self.sessionid = sid;
      self.closeTimeout = close;
      self.heartbeatTimeout = heartbeat;
      self.transports = io.util.intersect(transports.split(','), self.options.transports);
      self.transport = self.getTransport();

      if (!self.transport) {
        return;
      }

      self.connecting = true;
      self.emit('connecting', self.transport.name);

      self.transport.open();

      if (self.options.connectTimeout) {
        self.connectTimeoutTimer = setTimeout(function () {
          if (!self.connected) {
            if (self.options['try multiple transports']){
              if (!self.remainingTransports) {
                self.remainingTransports = self.transports.slice(0);
              }

              var transports = self.remainingTransports;

              while (transports.length > 0 && transports.splice(0,1)[0] !=
                self.transport.name) {}

              if (transports.length) {
                self.transport = self.getTransport(transports);
                self.connect();
              }
            }

            if (!self.remainingTransports || self.remainingTransports.length == 0) {
              self.emit('connect_failed');
            }
          }

          if(self.remainingTransports && self.remainingTransports.length == 0) {
            delete self.remainingTransports;
          }
        }, self.options['connect timeout']);
      }

      if (fn && typeof fn == 'function') {
        self.once('connect', fn);
      }
    });

    return this;
  };

  /**
   * Sends a message.
   *
   * @param {Mixed} data The data that needs to be send to the Socket.IO server.
   * @returns {io.Socket}
   * @api public
   */

  Socket.prototype.packet = function (data) {
    this.transport.packet(data);
    return this;
  };

  /**
   * Disconnect the established connect.
   *
   * @returns {io.Socket}
   * @api public
   */

  Socket.prototype.disconnect = function (sync) {
    if (this.connected) {
      if (this.open) {
        this.of('').packet({ type: 'disconnect' });
      }

      // ensure disconnection
      var xhr = io.util.request();
      xhr.open('GET', this.resource + '/' + io.protocol + '/' + this.sessionid);

      if (sync) {
        xhr.sync = true;
      }

      // handle disconnection immediately
      this.onDisconnect();
    }

    return this;
  };

  /**
   * Check if we need to use cross domain enabled transports. Cross domain would
   * be a different port or different domain name.
   *
   * @returns {Boolean}
   * @api private
   */

  Socket.prototype.isXDomain = function () {
    var locPort = window.location.port || 80;
    return this.options.host !== document.domain || this.options.port != locPort;
  };

  /**
   * Called upon handshake.
   *
   * @api private
   */

  Socket.prototype.onConnect = function(){
    this.connected = true;
    this.connecting = false;
    this.emit('connect');

    for (var i in this.namespaces) {
      this.of(i).$emit('connect');
    }
  };

  /**
   * Called when the transport opens
   *
   * @api private
   */

  Socket.prototype.onOpen = function () {
    if (!this.connected) {
      this.onConnect();
    }

    this.open = true;
  };

  /**
   * Called when the transport closes.
   *
   * @api private
   */

  Socket.prototype.onClose = function () {
    this.open = false;
  };

  /**
   * Called when the transport first opens a connection
   *
   * @param text
   */

  Socket.prototype.onPacket = function (packet) {
    this.of(packet.endpoint).onPacket(packet);
  };

  /**
   * Handles an error.
   *
   * @api private
   */

  Socket.prototype.onError = function (err) {
    this.emit('error', err);

    for (var i in this.namespaces) {
      this.of(i).$emit('error', err);
    }
  };

  /**
   * Called when the transport disconnects.
   *
   * @api private
   */

  Socket.prototype.onDisconnect = function (reason) {
    var wasConnected = this.connected;

    this.connected = false;
    this.connecting = false;
    this.open = false;

    if (wasConnected) {
      this.emit('disconnect');

      this.transport.clearTimeouts();

      for (var i in this.namespaces) {
        this.of(i).$emit('disconnect', reason);
      }

      if (this.options.reconnect && !this.reconnecting) {
        this.reconnect();
      }
    }
  };

  /**
   * Called upon reconnection.
   *
   * @api private
   */

  Socket.prototype.reconnect = function () {
    this.reconnecting = true;
    this.reconnectionAttempts = 0;
    this.reconnectionDelay = this.options['reconnection delay'];

    var self = this
      , maxAttempts = this.options['max reconnection attempts']
      , tryMultiple = this.options['try multiple transports']

    function reset () {
      if (self.connected) {
        self.emit('reconnect', self.transport.name, self.reconnectionAttempts);
      }

      self.removeListener('connect_failed', maybeReconnect);
      self.removeListener('connect', maybeReconnect);

      self.reconnecting = false;

      delete self.reconnectionAttempts;
      delete self.reconnectionDelay;
      delete self.reconnectionTimer;
      delete self.redoTransports;

      self.options['try multiple transports'] = tryMultiple;
    };

    function maybeReconnect () {
      if (!self.reconnecting) {
        return;
      }

      if (self.connected) {
        return reset();
      };

      if (self.connecting && self.reconnecting) {
        return self.reconnectionTimer = setTimeout(maybeReconnect, 1000);
      }

      if (self.reconnectionAttempts++ >= maxAttempts) {
        if (!self.redoTransports) {
          self.on('connect_failed', maybeReconnect);
          self.options['try multiple transports'] = true;
          self.transport = self.getTransport();
          self.redoTransports = true;
          self.connect();
        } else {
          self.emit('reconnect_failed');
          reset();
        }
      } else {
        self.reconnectionDelay *= 2; // exponential back off
        self.connect();
        self.emit('reconnecting', self.reconnectionDelay, self.reconnectionAttempts);
        self.reconnectionTimer = setTimeout(maybeReconnect, self.reconnectionDelay);
      }
    };

    this.options['try multiple transports'] = false;
    this.reconnectionTimer = setTimeout(maybeReconnect, this.reconnectionDelay);

    this.on('connect', maybeReconnect);
  };

})(
    'undefined' != typeof io ? io : module.exports
  , 'undefined' != typeof io ? io : module.parent.exports
);
