'use strict';

/**
 * Module dependencies.
 */

var http = require('http');
var read = require('fs').readFileSync;
var engine = require('engine.io');
var client = require('socket.io-client');
var clientVersion = require('socket.io-client/package').version;
var Client = require('./client');
var Namespace = require('./namespace');
var Adapter = require('socket.io-adapter');
var debug = require('debug')('socket.io:server');
var url = require('url');

/**
 * Socket.IO client source.
 */

var clientSource = read(require.resolve('socket.io-client/socket.io.js'), 'utf-8');

/**
 * Old settings for backwards compatibility
 */

var oldSettings = {
  "transports": "transports",
  "heartbeat timeout": "pingTimeout",
  "heartbeat interval": "pingInterval",
  "destroy buffer size": "maxHttpBufferSize"
};

/**
 * Server constructor.
 *
 * @param {http.Server|Number|Object} srv http server, port or options
 * @param {Object} opts
 * @api public
 */

class _Server{
  constructor(srv, opts){
    if ('object' == typeof srv && !srv.listen) {
      opts = srv;
      srv = null;
    }
    opts = opts || {};
    this.nsps = {};
    this.path(opts.path || '/socket.io');
    this.serveClient(false !== opts.serveClient);
    this.adapter(opts.adapter || Adapter);
    this.origins(opts.origins || '*:*');
    this.sockets = this.of('/');
    if (srv) this.attach(srv, opts);
  }
    
  /**
   * Server request verification function, that checks for allowed origins
   *
   * @param {http.IncomingMessage} req request
   * @param {Function} fn callback to be called with the result: `fn(err, success)`
   */

  checkRequest(req, fn) {
    var origin = req.headers.origin || req.headers.referer;

    // file:// URLs produce a null Origin which can't be authorized via echo-back
    if ('null' == origin || null == origin) origin = '*';

    if (!!origin && typeof(this._origins) == 'function') return this._origins(origin, fn);
    if (this._origins.indexOf('*:*') !== -1) return fn(null, true);
    if (origin) {
      try {
        var parts = url.parse(origin);
        var defaultPort = 'https:' == parts.protocol ? 443 : 80;
        parts.port = parts.port != null
          ? parts.port
          : defaultPort;
        var ok =
          ~this._origins.indexOf(parts.hostname + ':' + parts.port) ||
          ~this._origins.indexOf(parts.hostname + ':*') ||
          ~this._origins.indexOf('*:' + parts.port);
        return fn(null, !!ok);
      } catch (ex) {
      }
    }
    fn(null, false);
  }

  /**
   * Sets/gets whether client code is being served.
   *
   * @param {Boolean} v whether to serve client code
   * @return {Server|Boolean} self when setting or value when getting
   * @api public
   */

  serveClient(v){
    if (!arguments.length) return this._serveClient;
    this._serveClient = v;
    return this;
  }

  /**
   * Backwards compatiblity.
   *
   * @api public
   */

  set(key, val){
    if ('authorization' == key && val) {
      this.use(function(socket, next) {
        val(socket.request, function(err, authorized) {
          if (err) return next(new Error(err));
          if (!authorized) return next(new Error('Not authorized'));
          next();
        });
      });
    } else if ('origins' == key && val) {
      this.origins(val);
    } else if ('resource' == key) {
      this.path(val);
    } else if (oldSettings[key] && this.eio[oldSettings[key]]) {
      this.eio[oldSettings[key]] = val;
    } else {
      console.error('Option %s is not valid. Please refer to the README.', key);
    }

    return this;
  }

  /**
   * Sets the client serving path.
   *
   * @param {String} v pathname
   * @return {Server|String} self when setting or value when getting
   * @api public
   */

  path(v){
    if (!arguments.length) return this._path;
    this._path = v.replace(/\/$/, '');
    return this;
  }

  /**
   * Sets the adapter for rooms.
   *
   * @param {Adapter} v pathname
   * @return {Server|Adapter} self when setting or value when getting
   * @api public
   */

  adapter(v){
    if (!arguments.length) return this._adapter;
    this._adapter = v;
    for (var i in this.nsps) {
      if (this.nsps.hasOwnProperty(i)) {
        this.nsps[i].initAdapter();
      }
    }
    return this;
  }

  /**
   * Sets the allowed origins for requests.
   *
   * @param {String} v origins
   * @return {Server|Adapter} self when setting or value when getting
   * @api public
   */

  origins(v){
    if (!arguments.length) return this._origins;

    this._origins = v;
    return this;
  }

  /**
   * Attaches socket.io to a server or port.
   *
   * @param {http.Server|Number} server or port
   * @param {Object} options passed to engine.io
   * @return {Server} self
   * @api public
   */

  attach(srv, opts){
    if ('function' == typeof srv) {
      var msg = 'You are trying to attach socket.io to an express ' +
      'request handler function. Please pass a http.Server instance.';
      throw new Error(msg);
    }

    // handle a port as a string
    if (Number(srv) == srv) {
      srv = Number(srv);
    }

    if ('number' == typeof srv) {
      debug('creating http server and binding to %d', srv);
      var port = srv;
      srv = http.Server(function(req, res){
        res.writeHead(404);
        res.end();
      });
      srv.listen(port);

    }

    // set engine.io path to `/socket.io`
    opts = opts || {};
    opts.path = opts.path || this.path();
    // set origins verification
    opts.allowRequest = opts.allowRequest || this.checkRequest.bind(this);

    // initialize engine
    debug('creating engine.io instance with opts %j', opts);
    this.eio = engine.attach(srv, opts);

    // attach static file serving
    if (this._serveClient) this.attachServe(srv);

    // Export http server
    this.httpServer = srv;

    // bind to engine events
    this.bind(this.eio);

    return this;
  }

  /**
   * Attaches the static file serving.
   *
   * @param {Function|http.Server} srv http server
   * @api private
   */

  attachServe(srv){
    debug('attaching client serving req handler');
    var url = this._path + '/socket.io.js';
    var evs = srv.listeners('request').slice(0);
    var self = this;
    srv.removeAllListeners('request');
    srv.on('request', function(req, res) {
      if (0 === req.url.indexOf(url)) {
        self.serve(req, res);
      } else {
        for (var i = 0; i < evs.length; i++) {
          evs[i].call(srv, req, res);
        }
      }
    });
  }

  /**
   * Handles a request serving `/socket.io.js`
   *
   * @param {http.Request} req
   * @param {http.Response} res
   * @api private
   */

  serve(req, res){
    var etag = req.headers['if-none-match'];
    if (etag) {
      if (clientVersion == etag) {
        debug('serve client 304');
        res.writeHead(304);
        res.end();
        return;
      }
    }

    debug('serve client source');
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('ETag', clientVersion);
    res.writeHead(200);
    res.end(clientSource);
  }

  /**
   * Binds socket.io to an engine.io instance.
   *
   * @param {engine.Server} engine engine.io (or compatible) server
   * @return {Server} self
   * @api public
   */

  bind(engine){
    this.engine = engine;
    this.engine.on('connection', this.onconnection.bind(this));
    return this;
  }

  /**
   * Called with each incoming transport connection.
   *
   * @param {engine.Socket} conn
   * @return {Server} self
   * @api public
   */

  onconnection(conn){
    debug('incoming connection with id %s', conn.id);
    var client = new Client(this, conn);
    client.connect('/');
    return this;
  }

  /**
   * Looks up a namespace.
   *
   * @param {String} name nsp name
   * @param {Function} fn optional, nsp `connection` ev handler
   * @api public
   */

  of(name, fn){
    if (String(name)[0] !== '/') name = '/' + name;
    
    var nsp = this.nsps[name];
    if (!nsp) {
      debug('initializing namespace %s', name);
      nsp = new Namespace(this, name);
      this.nsps[name] = nsp;
    }
    if (fn) nsp.on('connect', fn);
    return nsp;
  }

  /**
   * Closes server connection
   *
   * @api public
   */

  close(){
    for (var id in this.nsps['/'].sockets) {
      if (this.nsps['/'].sockets.hasOwnProperty(id)) {
        this.nsps['/'].sockets[id].onclose();
      }
    }

    this.engine.close();

    if(this.httpServer){
      this.httpServer.close();
    }
  }

}

/**
 * Methods sharing functions
 */
_Server.prototype.listen = _Server.prototype.attach;

/**
 * Expose main namespace (/).
 */

['on', 'to', 'in', 'use', 'emit', 'send', 'write', 'clients', 'compress'].forEach(function(fn){
  _Server.prototype[fn] = function(){
    var nsp = this.sockets[fn];
    return nsp.apply(this.sockets, arguments);
  };
});

Namespace.flags().forEach(function(flag){
  _Server.prototype.__defineGetter__(flag, function(){
    this.sockets.flags = this.sockets.flags || {};
    this.sockets.flags[flag] = true;
    return this;
  });
});

/**
 * BC with `io.listen`
 */

_Server.listen = _Server;

/**
 * function Server 
 */

function Server(srv, opts){
  if (!(this instanceof _Server)) return new _Server(srv, opts);
}

Server.prototype = _Server.prototype;

/**
 * Module exports.
 */

module.exports = Server;


