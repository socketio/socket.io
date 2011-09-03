/*!
 * socket.io-node
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var fs = require('fs')
  , url = require('url')
  , util = require('./util')
  , store = require('./store')
  , client = require('socket.io-client')
  , transports = require('./transports')
  , Logger = require('./logger')
  , Socket = require('./socket')
  , MemoryStore = require('./stores/memory')
  , SocketNamespace = require('./namespace')
  , EventEmitter = process.EventEmitter;

/**
 * Export the constructor.
 */

exports = module.exports = Manager;

/**
 * Default transports.
 */

var defaultTransports = exports.defaultTransports = [
    'websocket'
  , 'htmlfile'
  , 'xhr-polling'
  , 'jsonp-polling'
];

/**
 * Inherited defaults.
 */

var parent = module.parent.exports
  , protocol = parent.protocol;

/**
 * Manager constructor.
 *
 * @param {HTTPServer} server
 * @param {Object} options, optional
 * @api public
 */

function Manager (server, options) {
  this.server = server;
  this.namespaces = {};
  this.sockets = this.of('');
  this.settings = {
      origins: '*:*'
    , log: true
    , store: new MemoryStore
    , logger: new Logger
    , heartbeats: true
    , resource: '/socket.io'
    , transports: defaultTransports
    , authorization: false
    , 'log level': 3
    , 'close timeout': 25
    , 'heartbeat timeout': 15
    , 'heartbeat interval': 20
    , 'polling duration': 20
    , 'flash policy server': true
    , 'flash policy port': 10843
    , 'destroy upgrade': true
    , 'browser client': true
    , 'browser client minification': false
    , 'browser client etag': false
    , 'browser client handler': false
    , 'client store expiration': 15
  };

  for (var i in options) {
    this.settings[i] = options[i];
  }

  this.initStore();

  // reset listeners
  this.oldListeners = server.listeners('request');
  server.removeAllListeners('request');

  var self = this;

  server.on('request', function (req, res) {
    self.handleRequest(req, res);
  });

  server.on('upgrade', function (req, socket, head) {
    self.handleUpgrade(req, socket, head);
  });

  server.on('close', function () {
    clearInterval(self.gc);
  });

  server.once('listening', function () {
    self.gc = setInterval(self.garbageCollection.bind(self), 10000);
  });

  for (var i in transports) {
    if (transports[i].init) {
      transports[i].init(this);
    }
  }

  this.log.info('socket.io started');
};

Manager.prototype.__proto__ = EventEmitter.prototype

/**
 * Store accessor shortcut.
 *
 * @api public
 */

Manager.prototype.__defineGetter__('store', function () {
  var store = this.get('store');
  store.manager = this;
  return store;
});

/**
 * Logger accessor.
 *
 * @api public
 */

Manager.prototype.__defineGetter__('log', function () {
  if (this.disabled('log')) return;

  var logger = this.get('logger');
  logger.level = this.get('log level') || -1;

  return logger;
});

/**
 * Get settings.
 *
 * @api public
 */

Manager.prototype.get = function (key) {
  return this.settings[key];
};

/**
 * Set settings
 *
 * @api public
 */

Manager.prototype.set = function (key, value) {
  if (arguments.length == 1) return this.get(key);
  this.settings[key] = value;
  this.emit('set:' + key, this.settings[key], key);
  return this;
};

/**
 * Enable a setting
 *
 * @api public
 */

Manager.prototype.enable = function (key) {
  this.settings[key] = true;
  this.emit('set:' + key, this.settings[key], key);
  return this;
};

/**
 * Disable a setting
 *
 * @api public
 */

Manager.prototype.disable = function (key) {
  this.settings[key] = false;
  this.emit('set:' + key, this.settings[key], key);
  return this;
};

/**
 * Checks if a setting is enabled
 *
 * @api public
 */

Manager.prototype.enabled = function (key) {
  return !!this.settings[key];
};

/**
 * Checks if a setting is disabled
 *
 * @api public
 */

Manager.prototype.disabled = function (key) {
  return !this.settings[key];
};

/**
 * Configure callbacks.
 *
 * @api public
 */

Manager.prototype.configure = function (env, fn) {
  if ('function' == typeof env) {
    env.call(this);
  } else if (env == process.env.NODE_ENV) {
    fn.call(this);
  }

  return this;
};

/**
 * Initializes everything related to the message dispatcher.
 *
 * @api private
 */

Manager.prototype.initStore = function () {
  this.handshaken = {};
  this.connected = {};
  this.open = {};
  this.closed = {};
  this.closedA = [];
  this.rooms = {};
  this.roomClients = {};

  var self = this;

  this.store.subscribe('handshake', function (id, data) {
    self.onHandshake(id, data);
  });

  this.store.subscribe('connect', function (id) {
    self.onConnect(id);
  });

  this.store.subscribe('open', function (id) {
    self.onOpen(id);
  });

  this.store.subscribe('join', function (id, room) {
    self.onJoin(id, room);
  });

  this.store.subscribe('leave', function (id, room) {
    self.onLeave(id, room);
  });

  this.store.subscribe('close', function (id) {
    self.onClose(id);
  });

  this.store.subscribe('dispatch', function (room, packet, volatile, exceptions) {
    self.onDispatch(room, packet, volatile, exceptions);
  });

  this.store.subscribe('disconnect', function (id) {
    self.onDisconnect(id);
  });
};

/**
 * Called when a client handshakes.
 *
 * @param text
 */

Manager.prototype.onHandshake = function (id, data) {
  this.handshaken[id] = data;
};

/**
 * Called when a client connects (ie: transport first opens)
 *
 * @api private
 */

Manager.prototype.onConnect = function (id) {
  this.connected[id] = true;
};

/**
 * Called when a client opens a request in a different node.
 *
 * @api private
 */

Manager.prototype.onOpen = function (id) {
  this.open[id] = true;

  // if we were buffering messages for the client, clear them
  if (this.closed[id]) {
    var self = this;

    this.closedA.splice(this.closedA.indexOf(id), 1);

    this.store.unsubscribe('dispatch:' + id, function () {
      delete self.closed[id];
    });
  }

  // clear the current transport
  if (this.transports[id]) {
    this.transports[id].discard();
    this.transports[id] = null;
  }
};

/**
 * Called when a message is sent to a namespace and/or room.
 *
 * @api private
 */

Manager.prototype.onDispatch = function (room, packet, volatile, exceptions) {
  if (this.rooms[room]) {
    for (var i = 0, l = this.rooms[room].length; i < l; i++) {
      var id = this.rooms[room][i];

      if (!~exceptions.indexOf(id)) {
        if (this.transports[id] && this.transports[id].open) {
          this.transports[id].onDispatch(packet, volatile);
        } else if (!volatile) {
          this.onClientDispatch(id, packet);
        }
      }
    }
  }
};

/**
 * Called when a client joins a nsp / room.
 *
 * @api private
 */

Manager.prototype.onJoin = function (id, name) {
  if (!this.roomClients[id]) {
    this.roomClients[id] = {};
  }

  if (!this.rooms[name]) {
    this.rooms[name] = [];
  }

  if (!~this.rooms[name].indexOf(id)) {
    this.rooms[name].push(id);
    this.roomClients[id][name] = true;
  }
};

/**
 * Called when a client leaves a nsp / room.
 *
 * @param private
 */

Manager.prototype.onLeave = function (id, room) {
  if (this.rooms[room]) {
    var index = this.rooms[room].indexOf(id);

    if (index >= 0) {
      this.rooms[room].splice(index, 1);
    }

    if (!this.rooms[room].length) {
      delete this.rooms[room];
    }
    delete this.roomClients[id][room];
  }
};

/**
 * Called when a client closes a request in different node.
 *
 * @api private
 */

Manager.prototype.onClose = function (id) {
  if (this.open[id]) {
    delete this.open[id];
  }

  this.closed[id] = [];
  this.closedA.push(id);

  var self = this;

  this.store.subscribe('dispatch:' + id, function (packet, volatile) {
    if (!volatile) {
      self.onClientDispatch(id, packet);
    }
  });
};

/**
 * Dispatches a message for a closed client.
 *
 * @api private
 */

Manager.prototype.onClientDispatch = function (id, packet) {
  if (this.closed[id]) {
    this.closed[id].push(packet);
  }
};

/**
 * Receives a message for a client.
 *
 * @api private
 */

Manager.prototype.onClientMessage = function (id, packet) {
  if (this.namespaces[packet.endpoint]) {
    this.namespaces[packet.endpoint].handlePacket(id, packet);
  }
};

/**
 * Fired when a client disconnects (not triggered).
 *
 * @api private
 */

Manager.prototype.onClientDisconnect = function (id, reason) {
  for (var name in this.namespaces) {
    if (this.roomClients[id][name]) {
      this.namespaces[name].handleDisconnect(id, reason);
    }
  }

  this.onDisconnect(id);
};

/**
 * Called when a client disconnects.
 *
 * @param text
 */

Manager.prototype.onDisconnect = function (id, local) {
  delete this.handshaken[id];

  if (this.open[id]) {
    delete this.open[id];
  }

  if (this.connected[id]) {
    delete this.connected[id];
  }

  if (this.transports[id]) {
    this.transports[id].discard();
    delete this.transports[id];
  }

  if (this.closed[id]) {
    delete this.closed[id];
    this.closedA.splice(this.closedA.indexOf(id), 1);
  }

  if (this.roomClients[id]) {
    for (var room in this.roomClients[id]) {
      this.onLeave(id, room);
    }
    delete this.roomClients[id]
  }

  this.store.destroyClient(id, this.get('client store expiration'));

  this.store.unsubscribe('dispatch:' + id);

  if (local) {
    this.store.unsubscribe('message:' + id);
    this.store.unsubscribe('disconnect:' + id);
  }
};

/**
 * Handles an HTTP request.
 *
 * @api private
 */

Manager.prototype.handleRequest = function (req, res) {
  var data = this.checkRequest(req);

  if (!data) {
    for (var i = 0, l = this.oldListeners.length; i < l; i++) {
      this.oldListeners[i].call(this.server, req, res);
    }

    return;
  }

  if (data.static || !data.transport && !data.protocol) {
    if (data.static && this.enabled('browser client')) {
      this.handleClientRequest(req, res, data);
    } else {
      res.writeHead(200);
      res.end('Welcome to socket.io.');

      this.log.info('unhandled socket.io url');
    }

    return;
  }

  if (data.protocol != protocol) {
    res.writeHead(500);
    res.end('Protocol version not supported.');

    this.log.info('client protocol version unsupported');
  } else {
    if (data.id) {
      this.handleHTTPRequest(data, req, res);
    } else {
      this.handleHandshake(data, req, res);
    }
  }
};

/**
 * Handles an HTTP Upgrade.
 *
 * @api private
 */

Manager.prototype.handleUpgrade = function (req, socket, head) {
  var data = this.checkRequest(req)
    , self = this;

  if (!data) {
    if (this.enabled('destroy upgrade')) {
      socket.end();
      this.log.debug('destroying non-socket.io upgrade');
    }

    return;
  }

  req.head = head;
  this.handleClient(data, req);
};

/**
 * Handles a normal handshaken HTTP request (eg: long-polling)
 *
 * @api private
 */

Manager.prototype.handleHTTPRequest = function (data, req, res) {
  req.res = res;
  this.handleClient(data, req);
};

/**
 * Intantiantes a new client.
 *
 * @api private
 */

Manager.prototype.handleClient = function (data, req) {
  var socket = req.socket
    , store = this.store
    , self = this;

  if (undefined != data.query.disconnect) {
    if (this.transports[data.id] && this.transports[data.id].open) {
      this.transports[data.id].onForcedDisconnect();
    } else {
      this.store.publish('disconnect-force:' + data.id);
    }
    return;
  }

  if (!~this.get('transports').indexOf(data.transport)) {
    this.log.warn('unknown transport: "' + data.transport + '"');
    req.connection.end();
    return;
  }

  var transport = new transports[data.transport](this, data, req)
    , handshaken = this.handshaken[data.id];

  if (handshaken) {
    if (transport.open) {
      if (this.closed[data.id] && this.closed[data.id].length) {
        transport.payload(this.closed[data.id]);
        this.closed[data.id] = [];
      }

      this.onOpen(data.id);
      this.store.publish('open', data.id);
      this.transports[data.id] = transport;
    }

    if (!this.connected[data.id]) {
      this.onConnect(data.id);
      this.store.publish('connect', data.id);

      // flag as used
      delete handshaken.issued;
      this.onHandshake(data.id, handshaken);
      this.store.publish('handshake', data.id, handshaken);

      // initialize the socket for all namespaces
      for (var i in this.namespaces) {
        var socket = this.namespaces[i].socket(data.id, true);

        // echo back connect packet and fire connection event
        if (i === '') {
          this.namespaces[i].handlePacket(data.id, { type: 'connect' });
        }
      }

      this.store.subscribe('message:' + data.id, function (packet) {
        self.onClientMessage(data.id, packet);
      });

      this.store.subscribe('disconnect:' + data.id, function (reason) {
        self.onClientDisconnect(data.id, reason);
      });
    }
  } else {
    if (transport.open) {
      transport.error('client not handshaken', 'reconnect');
    }

    transport.discard();
  }
};

/**
 * Dictionary for static file serving
 *
 * @api public
 */

Manager.static = {
    cache: {}
  , paths: {
        '/static/flashsocket/WebSocketMain.swf': client.dist + '/WebSocketMain.swf'
      , '/static/flashsocket/WebSocketMainInsecure.swf':
          client.dist + '/WebSocketMainInsecure.swf'
      , '/socket.io.js':  client.dist + '/socket.io.js'
      , '/socket.io.js.min': client.dist + '/socket.io.min.js'
    }
  , mime: {
        'js': {
            contentType: 'application/javascript'
          , encoding: 'utf8'
        }
      , 'swf': {
            contentType: 'application/x-shockwave-flash'
          , encoding: 'binary'
        }
    }
};

/**
 * Serves the client.
 *
 * @api private
 */

Manager.prototype.handleClientRequest = function (req, res, data) {
  var static = Manager.static
    , extension = data.path.split('.').pop()
    , file = data.path + (this.enabled('browser client minification')
        && extension == 'js' ? '.min' : '')
    , location = static.paths[file]
    , cache = static.cache[file];

  var self = this;

  /**
   * Writes a response, safely
   *
   * @api private
   */

  function write (status, headers, content, encoding) {
    try {
      res.writeHead(status, headers || null);
      res.end(content || '', encoding || null);
    } catch (e) {}
  }

  function serve () {
    if (req.headers['if-none-match'] === cache.Etag) {
      return write(304);
    }

    var mime = static.mime[extension]
      , headers = {
      'Content-Type': mime.contentType
    , 'Content-Length': cache.length
    };

    if (self.enabled('browser client etag') && cache.Etag) {
      headers.Etag = cache.Etag;
    }

    write(200, headers, cache.content, mime.encoding);
    self.log.debug('served static ' + data.path);
  }

  if (this.get('browser client handler')) {
    this.get('browser client handler').call(this, req, res);
  } else if (!cache) {
    fs.readFile(location, function (err, data) {
      if (err) {
        write(500, null, 'Error serving static ' + data.path);
        self.log.warn('Can\'t cache '+ data.path +', ' + err.message);
        return;
      }

      cache = Manager.static.cache[file] = {
        content: data
      , length: data.length
      , Etag: client.version
      };

      serve();
    });
  } else {
    serve();
  }
};

/**
 * Generates a session id.
 *
 * @api private
 */

Manager.prototype.generateId = function () {
  return Math.abs(Math.random() * Math.random() * Date.now() | 0).toString()
    + Math.abs(Math.random() * Math.random() * Date.now() | 0).toString();
};

/**
 * Handles a handshake request.
 *
 * @api private
 */

Manager.prototype.handleHandshake = function (data, req, res) {
  var self = this;

  function writeErr (status, message) {
    if (data.query.jsonp) {
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      res.end('io.j[' + data.query.jsonp + '](new Error("' + message + '"));');
    } else {
      res.writeHead(status, { 'Content-Type': 'text/plain' });
      res.end(message);
    }
  };

  function error (err) {
    writeErr(500, 'handshake error');
    self.log.warn('handshake error ' + err);
  };

  if (!this.verifyOrigin(req)) {
    writeErr(403, 'handshake bad origin');
    return;
  }

  var handshakeData = this.handshakeData(data);

  this.authorize(handshakeData, function (err, authorized, newData) {
    if (err) return error(err);

    if (authorized) {
      var id = self.generateId()
        , hs = [
              id
            , self.enabled('heartbeats') ? self.get('heartbeat timeout') || '' : ''
            , self.get('close timeout') || ''
            , self.transports(data).join(',')
          ].join(':');

      if (data.query.jsonp) {
        hs = 'io.j[' + data.query.jsonp + '](' + JSON.stringify(hs) + ');';
        res.writeHead(200, { 'Content-Type': 'application/javascript' });
      } else {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
      }

      res.end(hs);

      self.onHandshake(id, newData || handshakeData);
      self.store.publish('handshake', id, newData || handshakeData);

      self.log.info('handshake authorized', id);
    } else {
      writeErr(403, 'handshake unauthorized');
      self.log.info('handshake unauthorized');
    }
  })
};

/**
 * Gets normalized handshake data
 *
 * @api private
 */

Manager.prototype.handshakeData = function (data) {
  var connection = data.request.connection
    , connectionAddress
    , date = new Date;

  if (connection.remoteAddress) {
    connectionAddress = {
        address: connection.remoteAddress
      , port: connection.remotePort
    }; 
  } else if (connection.socket && connection.socket.remoteAddress) {
    connectionAddress = {
        address: connection.socket.remoteAddress
      , port: connection.socket.remotePort
    }; 
  }

  return {
      headers: data.headers
    , address: connectionAddress
    , time: date.toString()
    , query: data.query
    , url: data.request.url
    , xdomain: !!data.request.headers.origin
    , secure: data.request.connection.secure
    , issued: +date
  };
};

/**
 * Verifies the origin of a request.
 *
 * @api private
 */

Manager.prototype.verifyOrigin = function (request) {
  var origin = request.headers.origin || request.headers.referer
    , origins = this.get('origins');

  if (origin === 'null') origin = '*';

  if (origins.indexOf('*:*') !== -1) {
    return true;
  }

  if (origin) {
    try {
      var parts = url.parse(origin);
      var ok =
        ~origins.indexOf(parts.hostname + ':' + parts.port) ||
        ~origins.indexOf(parts.hostname + ':*') ||
        ~origins.indexOf('*:' + parts.port);
      if (!ok) this.log.warn('illegal origin: ' + origin);
      return ok;
    } catch (ex) {
      this.log.warn('error parsing origin');
    }
  }
  else {
    this.log.warn('origin missing from handshake, yet required by config');        
  }
  return false;
};

/**
 * Handles an incoming packet.
 *
 * @api private
 */

Manager.prototype.handlePacket = function (sessid, packet) {
  this.of(packet.endpoint || '').handlePacket(sessid, packet);
};

/**
 * Performs authentication.
 *
 * @param Object client request data
 * @api private
 */

Manager.prototype.authorize = function (data, fn) {
  if (this.get('authorization')) {
    var self = this;

    this.get('authorization').call(this, data, function (err, authorized) {
      self.log.debug('client ' + authorized ? 'authorized' : 'unauthorized');
      fn(err, authorized);
    });
  } else {
    this.log.debug('client authorized');
    fn(null, true);
  }

  return this;
};

/**
 * Retrieves the transports adviced to the user.
 *
 * @api private
 */

Manager.prototype.transports = function (data) {
  var transp = this.get('transports')
    , ret = [];

  for (var i = 0, l = transp.length; i < l; i++) {
    var transport = transp[i];

    if (transport) {
      if (!transport.checkClient || transport.checkClient(data)) {
        ret.push(transport);
      }
    }
  }

  return ret;
};

/**
 * Checks whether a request is a socket.io one.
 *
 * @return {Object} a client request data object or `false`
 * @api private
 */

var regexp = /^\/([^\/]+)\/?([^\/]+)?\/?([^\/]+)?\/?$/

Manager.prototype.checkRequest = function (req) {
  var resource = this.get('resource');

  if (req.url.substr(0, resource.length) == resource) {
    var uri = url.parse(req.url.substr(resource.length), true)
      , path = uri.pathname || ''
      , pieces = path.match(regexp);

    // client request data
    var data = {
        query: uri.query || {}
      , headers: req.headers
      , request: req
      , path: path
    };

    if (pieces) {
      data.protocol = Number(pieces[1]);
      data.transport = pieces[2];
      data.id = pieces[3];
      data.static = !!Manager.static.paths[path];
    };

    return data;
  }

  return false;
};

/**
 * Declares a socket namespace
 *
 * @api public
 */

Manager.prototype.of = function (nsp) {
  if (this.namespaces[nsp]) {
    return this.namespaces[nsp];
  }

  return this.namespaces[nsp] = new SocketNamespace(this, nsp);
};

/**
 * Perform garbage collection on long living objects and properties that cannot
 * be removed automatically.
 *
 * @api private
 */

Manager.prototype.garbageCollection = function () {
  // clean up unused handshakes
  var ids = Object.keys(this.handshaken)
    , i = ids.length
    , now = Date.now()
    , handshake;

  while (i--) {
    handshake = this.handshaken[ids[i]];

    if ('issued' in handshake && (now - handshake.issued) >= 3E4) {
      this.onDisconnect(ids[i]);
    }
  }
};
