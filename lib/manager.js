
/*!
 * socket.io-node
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var http = require('http')
  , https = require('https')
  , fs = require('fs')
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

function Manager (server) {
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
    , 'flash policy port': 843
    , 'destroy upgrade': true
    , 'browser client': true
    , 'browser client minification': false
    , 'browser client etag': false
  };

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
  logger.level = this.get('log level');

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
    , newTransport = false
    , self = this;

  if (undefined != data.query.disconnect) {
    self.log.debug('handling disconnection url');
    self.store.disconnect(data.id, true);
    return;
  }

  if (!~this.get('transports').indexOf(data.transport)) {
    this.log.warn('unknown transport: "' + data.transport + '"');
    req.connection.end();
    return;
  }

  var transport = new transports[data.transport](this, data);
  transport.pause();
  transport.request = req;

  if (!transport.open) {
    this.log.debug('transport not writeable, not subscribing');
    return;
  }

  this.store.isHandshaken(data.id, function (err, handshaken) {
    if (err || !handshaken) {
      if (err) console.error(err);
      transport.error('client not handshaken', 'reconnect');
      return;
    }

    self.store.client(data.id).count(function (err, count) {
      transport.resume();

      if (count == 1) {
        // initialize the socket for all namespaces
        for (var i in self.namespaces) {
          var socket = self.namespaces[i].socket(data.id, true);

          // echo back connect packet and fire connection event
          if (i === '') {
            self.namespaces[i].handlePacket(data.id, { type: 'connect' });
          }
        }

        // handle packets for the client (all namespaces)
        self.store.on('message:' + data.id, function (packet) {
          self.handlePacket(data.id, packet);
        });
      }
    });
  });
};

/**
 * Dictionary for static file serving
 *
 * @api public
 */

Manager.static = {
  cache:{}
, paths: {
      '/static/flashsocket/WebSocketMain.swf': client.dist + '/WebSocketMain.swf'
    , '/static/flashsocket/WebSocketMainInsecure.swf': client.dist + '/WebSocketMainInsecure.swf'
    , '/socket.io.js':  client.dist + '/socket.io.js'
    , '/socket.io.js.min': client.dist + '/socket.io.min.js'
  }
, contentType: {
      'js': 'application/javascript'
    , 'swf': 'application/x-shockwave-flash'
  }
, encoding:{
      'js': 'utf8'
    , 'swf': 'binary'
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
    , file = data.path + (this.enabled('browser client minification') && extension == 'js' ? '.min' : '')
    , location = static.paths[file]
    , cache = static.cache[file];

  var self = this;

  function serve () {
    var headers = {
      'Content-Type': static.contentType[extension]
    , 'Content-Length': cache.length
    };

    if (self.enabled('browser client etag') && cache.Etag) {
      headers.Etag = cache.Etag;
    }

    res.writeHead(200, headers);
    res.end(cache.content, cache.encoding);

    self.log.debug('served static ' + data.path);
  }

  if (this.get('browser client handler')) {
    this.get('browser client handler').call(this, req, res);
  } else if (!cache) {
    fs.readFile(location, function (err, data) {
      if (err) {
        res.writeHead(500);
        res.end('Error serving socket.io client.');

        self.log.warn('Can\'t cache socket.io client, ' + err.message);
        return;
      }

      cache = Manager.static.cache[file] = {
        content: data
      , length: data.length
      , Etag: client.version
      , encoding: static.encoding[extension]
      };

      serve();
    });
  } else {
    serve();
  }
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
      res.writeHead(status);
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

  this.authorize(data, function (err, authorized) {
    if (err) return error(err);

    self.log.info('handshake ' + (authorized ? 'authorized' : 'unauthorized'));

    if (authorized) {
      self.store.handshake(data, function (err, id) {
        if (err) return error(err);

        var hs = [
            id
          , self.get('heartbeat timeout') || ''
          , self.get('close timeout') || ''
          , self.transports(data).join(',')
        ].join(':');

        if (data.query.jsonp) {
          hs = 'io.j[' + data.query.jsonp + '](' + JSON.stringify(hs) + ');';
          res.writeHead(200, { 'Content-Type': 'application/javascript' });
        } else {
          res.writeHead(200);
        }

        res.end(hs);
        self.log.info('handshaken', id);
      });
    } else {
      writeErr(403, 'handshake unauthorized');
    }
  })
};

/**
 * Verifies the origin of a request.
 *
 * @api private
 */

Manager.prototype.verifyOrigin = function (request) {
  var origin = request.headers.origin
    , origins = this.get('origins');

  if (origin === 'null') origin = '*';

  if (origins.indexOf('*:*') !== -1) {
    return true;
  }

  if (origin) {
    try {
      var parts = url.parse(origin);

      return
        ~origins.indexOf(parts.host + ':' + parts.port) ||
        ~origins.indexOf(parts.host + ':*') ||
        ~origins.indexOf('*:' + parts.port);
    } catch (ex) {}
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
 */

Manager.prototype.of = function (nsp) {
  if (this.namespaces[nsp]) {
    return this.namespaces[nsp];
  }

  return this.namespaces[nsp] = new SocketNamespace(this, nsp);
};
