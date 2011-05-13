/**
 * socket.io-node-client
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

(function(){
  var io = this.io;
  
  /**
   * Create a new `Socket.IO client` which can establish a persisted
   * connection with a Socket.IO enabled server.
   *
   * Options:
   *   - `secure`  Use secure connections, defaulting to false.
   *   - `document`  Reference to the document object to retrieve and set cookies, defaulting to document.
   *   - `port`  The port where the Socket.IO server listening on, defaulting to location.port.
   *   - `resource`  The path or namespace on the server where the Socket.IO requests are intercepted, defaulting to 'socket.io'.
   *   - `transports`  A ordered list with the available transports, defaulting to all transports.
   *   - `transportOption`  A {Object} containing the options for each transport. The key of the object should reflect
   *      name of the transport and the value a {Object} with the options.
   *   - `connectTimeout`  The duration in milliseconds that a transport has to establish a working connection, defaulting to 5000.
   *   - `tryTransportsOnConnectTimeout`  Should we attempt other transport methods when the connectTimeout occurs, defaulting to true.
   *   - `reconnect`  Should reconnection happen automatically, defaulting to true.
   *   - `reconnectionDelay`  The delay in milliseconds before we attempt to establish a working connection. This value will
   *      increase automatically using a exponential back off algorithm. Defaulting to 500.
   *   - `maxReconnectionAttempts`  Number of attempts we should make before seizing the reconnect operation, defaulting to 10.
   *   - `rememberTransport` Should the successfully connected transport be remembered in a cookie, defaulting to true.
   *
   * Examples:
   *
   * Create client with the default settings.
   *
   *     var socket = new io.Socket();
   *     socket.connect();
   *     socket.on('message', function(msg){
   *       console.log('Received message: ' + msg );
   *     });
   *     socket.on('connect', function(){
   *       socket.send('Hello from client');
   *     });
   *
   * Create a connection with server on a different port and host.
   *
   *     var socket = new io.Socket('http://example.com',{port:1337});
   *
   * @constructor
   * @exports Socket as io.Socket
   * @param {String} [host] The host where the Socket.IO server is located, it defaults to the host that runs the page.
   * @param {Objects} [options] The options that will configure the Socket.IO client. 
   * @property {String} host The supplied host arguments or the host that page runs.
   * @property {Object} options The passed options combined with the defaults.
   * @property {Boolean} connected Whether the socket is connected or not.
   * @property {Boolean} connecting Whether the socket is connecting or not.
   * @property {Boolean} reconnecting Whether the socket is reconnecting or not.
   * @property {Object} transport The selected transport instance.
   * @api public
   */
  var Socket = io.Socket = function(host, options){
    this.host = host || document.domain;
    this.options = {
      secure: false,
      document: document,
      port: document.location.port || 80,
      resource: 'socket.io',
      transports: ['websocket', 'flashsocket', 'htmlfile', 'xhr-multipart', 'xhr-polling', 'jsonp-polling'],
      transportOptions: {
        'xhr-polling': {
          timeout: 25000 // based on polling duration default
        },
        'jsonp-polling': {
          timeout: 25000
        }
      },
      connectTimeout: 5000,
      tryTransportsOnConnectTimeout: true,
      reconnect: true,
      reconnectionDelay: 500,
      maxReconnectionAttempts: 10,
      rememberTransport: true
    };
    io.util.merge(this.options, options);
    this.connected = false;
    this.connecting = false;
    this.reconnecting = false;
    this.events = {};
    this.transport = this.getTransport();
    if (!this.transport && 'console' in window) console.error('No transport available');
  };
  
  /**
   * Find an available transport based on the options supplied in the constructor. For example if the
   * `rememberTransport` option was set we will only connect with the previous successfully connected transport.
   * The supplied transports can be overruled if the `override` argument is supplied.
   *
   * Example:
   *
   * Override the existing transports.
   *
   *     var socket = new io.Socket();
   *     socket.getTransport(['jsonp-polling','websocket']);
   *     // returns the json-polling transport because it's availabe in all browsers.
   *
   * @param {Array} [override] A ordered list with transports that should be used instead of the options.transports.
   * @returns {Null|Transport} The available transport.
   * @api private
   */
  Socket.prototype.getTransport = function(override){
    var transports = override || this.options.transports, match;
    if (this.options.rememberTransport && !override){
      match = this.options.document.cookie.match('(?:^|;)\\s*socketio=([^;]*)');
      if (match){
        this.rememberedTransport = true;
        transports = [decodeURIComponent(match[1])];
      }
    } 
    for (var i = 0, transport; transport = transports[i]; i++){
      if (io.Transport[transport] 
        && io.Transport[transport].check() 
        && (!this.isXDomain() || io.Transport[transport].xdomainCheck())){
        return new io.Transport[transport](this, this.options.transportOptions[transport] || {});
      }
    }
    return null;
  };
  
  /**
   * Establish a new connection with the Socket.IO server. This is done using the selected transport by the
   * getTransport method. If the `connectTimeout` and the `tryTransportsOnConnectTimeout` options are set
   * the client will keep trying to connect to the server using a different transports when the timeout occurs.
   *
   * Example:
   *
   * Create a Socket.IO client with a connect callback (We assume we have the WebSocket transport avaliable).
   *
   *     var socket = new io.Socket();
   *     socket.connect(function(transport){
   *       console.log("Connected to server using the " + socket.transport.type + " transport.");
   *     });
   *     // => "Connected to server using the WebSocket transport."
   *
   * @param {Function} [fn] Callback.
   * @returns {io.Socket}
   * @api public
   */
  Socket.prototype.connect = function(fn){
    if (this.transport && !this.connected){
      if (this.connecting) this.disconnect(true);
      this.connecting = true;
      this.emit('connecting', [this.transport.type]);
      this.transport.connect();
      if (this.options.connectTimeout){
        var self = this;
        this.connectTimeoutTimer = setTimeout(function(){
          if (!self.connected){
            self.disconnect(true);
            if (self.options.tryTransportsOnConnectTimeout && !self.rememberedTransport){
              if(!self.remainingTransports) self.remainingTransports = self.options.transports.slice(0);
              var transports = self.remainingTransports;
              while(transports.length > 0 && transports.splice(0,1)[0] != self.transport.type){}
              if(transports.length){
                self.transport = self.getTransport(transports);
                self.connect();
              }
            }
            if(!self.remainingTransports || self.remainingTransports.length == 0) self.emit('connect_failed');
          }
          if(self.remainingTransports && self.remainingTransports.length == 0) delete self.remainingTransports;
        }, this.options.connectTimeout);
      }
    }
    if (fn && typeof fn == 'function') this.once('connect',fn);
    return this;
  };
  
  /**
   * Sends the data to the Socket.IO server. If there isn't a connection to the server
   * the data will be forwarded to the queue.
   *
   * @param {Mixed} data The data that needs to be send to the Socket.IO server.
   * @returns {io.Socket}
   * @api public
   */
  Socket.prototype.send = function(data){
    if (!this.transport || !this.transport.connected) return this.queue(data);
    this.transport.send(data);
    return this;
  };
  
  /**
   * Disconnect the established connect.
   *
   * @param {Boolean} [soft] A soft disconnect will keep the reconnect settings enabled.
   * @returns {io.Socket}
   * @api public
   */
  Socket.prototype.disconnect = function(soft){
    if (this.connectTimeoutTimer) clearTimeout(this.connectTimeoutTimer);
    if (!soft) this.options.reconnect = false;
    this.transport.disconnect();
    return this;
  };
  
  /**
   * Adds a new eventListener for the given event.
   *
   * Example:
   *
   *     var socket = new io.Socket();
   *     socket.on("connect", function(transport){
   *       console.log("Connected to server using the " + socket.transport.type + " transport.");
   *     });
   *     // => "Connected to server using the WebSocket transport."
   *
   * @param {String} name The name of the event.
   * @param {Function} fn The function that is called once the event is emitted.
   * @returns {io.Socket}
   * @api public
   */
  Socket.prototype.on = function(name, fn){
    if (!(name in this.events)) this.events[name] = [];
    this.events[name].push(fn);
    return this;
  };
  
  /**
   * Adds a one time listener, the listener will be removed after the event is emitted.
   *
   * Example:
   *
   *     var socket = new io.Socket();
   *     socket.once("custom:event", function(){
   *       console.log("I should only log once.");
   *     });
   *     socket.emit("custom:event");
   *     socket.emit("custom:event");
   *     // => "I should only log once."
   *
   * @param {String} name The name of the event.
   * @param {Function} fn The function that is called once the event is emitted.
   * @returns {io.Socket}
   * @api public
   */
  Socket.prototype.once = function(name, fn){
    var self = this
      , once = function(){
        self.removeEvent(name, once);
        fn.apply(self, arguments);
      };
    once.ref = fn;
    self.on(name, once);
    return this;
  };
  
  /**
   * Emit a event to all listeners.
   *
   * Example:
   *
   *     var socket = new io.Socket();
   *     socket.on("custom:event", function(){
   *       console.log("Emitted a custom:event");
   *     });
   *     socket.emit("custom:event");
   *     // => "Emitted a custom:event"
   *
   * @param {String} name The name of the event.
   * @param {Array} args Arguments for the event.
   * @returns {io.Socket}
   * @api private
   */
  Socket.prototype.emit = function(name, args){
    if (name in this.events){
      var events = this.events[name].concat();
      for (var i = 0, ii = events.length; i < ii; i++)
        events[i].apply(this, args === undefined ? [] : args);
    }
    return this;
  };

  /**
   * Removes a event listener from the listener array for the specified event.
   *
   * Example:
   *
   *     var socket = new io.Socket()
   *       , event = function(){};
   *     socket.on("connect", event);
   *     socket.removeEvent("connect", event);
   *
   * @param {String} name The name of the event.
   * @param {Function} fn The function that is called once the event is emitted.
   * @returns {io.Socket}
   * @api public
   */
  Socket.prototype.removeEvent = function(name, fn){
    if (name in this.events){
      for (var a = 0, l = this.events[name].length; a < l; a++)
        if (this.events[name][a] == fn || this.events[name][a].ref && this.events[name][a].ref == fn) this.events[name].splice(a, 1);    
    }
    return this;
  };
  
  /**
   * Queues messages when there isn't a active connection available. Once a connection has been
   * established you should call the `doQueue` method to send the queued messages to the server.
   *
   * @param {Mixed} message The message that was originally send to the `send` method.
   * @returns {io.Socket}
   * @api private
   */
  Socket.prototype.queue = function(message){
    if (!('queueStack' in this)) this.queueStack = [];
    this.queueStack.push(message);
    return this;
  };
  
  /**
   * If there are queued messages we send all messages to the Socket.IO server and empty
   * the queue.
   *
   * @returns {io.Socket}
   * @api private
   */
  Socket.prototype.doQueue = function(){
    if (!('queueStack' in this) || !this.queueStack.length) return this;
    this.transport.send(this.queueStack);
    this.queueStack = [];
    return this;
  };
  
  /**
   * Check if we need to use cross domain enabled transports. Cross domain would
   * be a different port or different domain name.
   *
   * @returns {Boolean}
   * @api private
   */
  Socket.prototype.isXDomain = function(){
    var locPort = window.location.port || 80;
    return this.host !== document.domain || this.options.port != locPort;
  };
  
  /**
   * When the transport established an working connection the Socket.IO server it notifies us
   * by calling this method so we can set the `connected` and `connecting` properties and emit
   * the connection event.
   *
   * @api private
   */
  Socket.prototype.onConnect = function(){
    this.connected = true;
    this.connecting = false;
    this.doQueue();
    if (this.options.rememberTransport) this.options.document.cookie = 'socketio=' + encodeURIComponent(this.transport.type);
    this.emit('connect');
  };
  
  /**
   * When the transport receives new messages from the Socket.IO server it notifies us by calling
   * this method with the decoded `data` it received.
   *
   * @param data The message from the Socket.IO server.
   * @api private
   */
  Socket.prototype.onMessage = function(data){
    this.emit('message', [data]);
  };
  
  /**
   * When the transport is disconnected from the Socket.IO server it notifies us by calling
   * this method. If we where connected and the `reconnect` is set we will attempt to reconnect.
   *
   * @api private
   */
  Socket.prototype.onDisconnect = function(){
    var wasConnected = this.connected;
    this.connected = false;
    this.connecting = false;
    this.queueStack = [];
    if (wasConnected){
      this.emit('disconnect');
      if (this.options.reconnect && !this.reconnecting) this.onReconnect();
    }
  };
  
  /**
   * The reconnection is done using an exponential back off algorithm to prevent
   * the server from being flooded with connection requests. When the transport
   * is disconnected we wait until the `reconnectionDelay` finishes. We multiply 
   * the `reconnectionDelay` (if the previous `reconnectionDelay` was 500 it will
   * be updated to 1000 and than 2000>4000>8000>16000 etc.) and tell the current
   * transport to connect again. When we run out of `reconnectionAttempts` we will 
   * do one final attempt and loop over all enabled transport methods to see if 
   * other transports might work. If everything fails we emit the `reconnect_failed`
   * event.
   *
   * @api private
   */
  Socket.prototype.onReconnect = function(){
    this.reconnecting = true;
    this.reconnectionAttempts = 0;
    this.reconnectionDelay = this.options.reconnectionDelay;
    
    var self = this
      , tryTransportsOnConnectTimeout = this.options.tryTransportsOnConnectTimeout
      , rememberTransport = this.options.rememberTransport;
    
    function reset(){
      if(self.connected) self.emit('reconnect',[self.transport.type,self.reconnectionAttempts]);
      self.removeEvent('connect_failed', maybeReconnect).removeEvent('connect', maybeReconnect);
      self.reconnecting = false;
      delete self.reconnectionAttempts;
      delete self.reconnectionDelay;
      delete self.reconnectionTimer;
      delete self.redoTransports;
      self.options.tryTransportsOnConnectTimeout = tryTransportsOnConnectTimeout;
      self.options.rememberTransport = rememberTransport;
      
      return;
    };
    
    function maybeReconnect(){
      if (!self.reconnecting) return;
      if (!self.connected){
        if (self.connecting && self.reconnecting) return self.reconnectionTimer = setTimeout(maybeReconnect, 1000);
        
        if (self.reconnectionAttempts++ >= self.options.maxReconnectionAttempts){
          if (!self.redoTransports){
            self.on('connect_failed', maybeReconnect);
            self.options.tryTransportsOnConnectTimeout = true;
            self.transport = self.getTransport(self.options.transports); // override with all enabled transports
            self.redoTransports = true;
            self.connect();
          } else {
            self.emit('reconnect_failed');
            reset();
          }
        } else {
          self.reconnectionDelay *= 2; // exponential back off
          self.connect();
          self.emit('reconnecting', [self.reconnectionDelay,self.reconnectionAttempts]);
          self.reconnectionTimer = setTimeout(maybeReconnect, self.reconnectionDelay);
        }
      } else {
        reset();
      }
    };
    this.options.tryTransportsOnConnectTimeout = false;
    this.reconnectionTimer = setTimeout(maybeReconnect, this.reconnectionDelay);
    
    this.on('connect', maybeReconnect);
  };
  
  /**
   * API compatiblity
   */
  Socket.prototype.fire = Socket.prototype.emit;
  Socket.prototype.addListener = Socket.prototype.addEvent = Socket.prototype.addEventListener = Socket.prototype.on;
  Socket.prototype.removeListener = Socket.prototype.removeEventListener = Socket.prototype.removeEvent;
  
})();