
/**
 * Module dependencies.
 */

var http = require('http');
var read = require('fs').readFileSync;
var parse = require('url').parse;
var engine = require('engine.io');
var client = require('socket.io-client');
var clientVersion = require('socket.io-client/package').version;
var Client = require('./client');
var Namespace = require('./namespace');
var Adapter = require('socket.io-adapter');
var debug = require('debug')('socket.io:server');
var url = require('url');

/**
 * Module exports.
 */

module.exports = Server;

/**
 * Socket.IO client source.
 */

var clientSource = read(require.resolve('socket.io-client/socket.io.js'), 'utf-8');

/**
 * Server constructor.
 *
 * @param {http.Server|Number|Object} http server, port or options
 * @param {Object} options
 * @api public
 */

function Server(srv, opts){
  if (!(this instanceof Server)) return new Server(srv, opts);
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
  this._cleanupTimer = null;
  this._cleanupTime = null;
  this._setupNames = {};
  this._setupPatterns = [];
  this._mainHost = makePattern(opts.host || '*');
  this._defaultRetirement = opts.retirement || 10000;
  this._serveStatus = opts.serveStatus || false;

  this.sockets = this.of('/');
  if (srv) this.attach(srv, opts);
}

/**
 * Server request verification function, that checks for allowed origins
 *
 * @param {http.IncomingMessage} request
 * @param {Function} callback to be called with the result: `fn(err, success)`
 */

Server.prototype.checkRequest = function(req, fn) {
  var origin = req.headers.origin || req.headers.referer;

  // file:// URLs produce a null Origin which can't be authorized via echo-back
  if ('null' == origin || null == origin) origin = '*';

  if (!!origin && typeof(this._origins) == 'function') return this._origins(origin, fn);
  if (this._origins.indexOf('*:*') !== -1) return fn(null, true);
  if (origin) {
    try {
      var parts = url.parse(origin);
      parts.port = parts.port || 80;
      var ok =
        ~this._origins.indexOf(parts.hostname + ':' + parts.port) ||
        ~this._origins.indexOf(parts.hostname + ':*') ||
        ~this._origins.indexOf('*:' + parts.port);
      return fn(null, !!ok);
    } catch (ex) {
    }
  }
  fn(null, false);
};

/**
 * Sets/gets whether client code is being served.
 *
 * @param {Boolean} whether to serve client code
 * @return {Server|Boolean} self when setting or value when getting
 * @api public
 */

Server.prototype.serveClient = function(v){
  if (!arguments.length) return this._serveClient;
  this._serveClient = v;
  return this;
};

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
 * Backwards compatiblity.
 *
 * @api public
 */

Server.prototype.set = function(key, val){
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
};

/**
 * Sets the client serving path.
 *
 * @param {String} pathname
 * @return {Server|String} self when setting or value when getting
 * @api public
 */

Server.prototype.path = function(v){
  if (!arguments.length) return this._path;
  this._path = v.replace(/\/$/, '');
  return this;
};

/**
 * Sets the adapter for rooms.
 *
 * @param {Adapter} pathname
 * @return {Server|Adapter} self when setting or value when getting
 * @api public
 */

Server.prototype.adapter = function(v){
  if (!arguments.length) return this._adapter;
  this._adapter = v;
  for (var i in this.nsps) {
    if (this.nsps.hasOwnProperty(i)) {
      this.nsps[i].initAdapter();
    }
  }
  return this;
};

/**
 * Sets the allowed origins for requests.
 *
 * @param {String} origins
 * @return {Server|Adapter} self when setting or value when getting
 * @api public
 */

Server.prototype.origins = function(v){
  if (!arguments.length) return this._origins;

  this._origins = v;
  return this;
};

/**
 * Attaches socket.io to a server or port.
 *
 * @param {http.Server|Number} server or port
 * @param {Object} options passed to engine.io
 * @return {Server} self
 * @api public
 */

Server.prototype.listen =
Server.prototype.attach = function(srv, opts){
  if ('function' == typeof srv) {
    var msg = 'You are trying to attach socket.io to an express' +
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
  opts.allowRequest = this.checkRequest.bind(this);

  // initialize engine
  debug('creating engine.io instance with opts %j', opts);
  this.eio = engine.attach(srv, opts);

  // attach static file serving
  if (this._serveClient || this._serveStatus) this.attachServe(srv);

  // Export http server
  this.httpServer = srv;

  // bind to engine events
  this.bind(this.eio);

  return this;
};

/**
 * Attaches the static file serving.
 *
 * @param {Function|http.Server} http server
 * @api private
 */

Server.prototype.attachServe = function(srv){
  debug('attaching client serving req handler');
  var clienturl = this._path + '/socket.io.js';
  var statusurl = this._path + '/status';
  var evs = srv.listeners('request').slice(0);
  var self = this;
  srv.removeAllListeners('request');
  srv.on('request', function(req, res) {
    if (self._serveClient && 0 == req.url.indexOf(clienturl)) {
      self.serve(req, res);
    } else if (self._serveState && 0 == req.url.indexOf(statusurl)) {
      self.status(req, res);
    } else {
      for (var i = 0; i < evs.length; i++) {
        evs[i].call(srv, req, res);
      }
    }
  });
};

/**
 * Handles a request serving `/socket.io.js`
 *
 * @param {http.Request} req
 * @param {http.Response} res
 * @api private
 */

Server.prototype.serve = function(req, res){
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
};

/**
 * Handles a request serving `/status`
 *
 * @param {http.Request} req
 * @param {http.Response} res
 * @api private
 */

Server.prototype.status = function(req, res){
  var match = '*';
  if (req && !matchPattern(this._mainHost, req.headers.host)) {
    match = req.headers.host;
  }
  var html = !res ? [] : ['<!doctype html>', '<html>', '<body>', '<pre>',
      '<a href="status">Refresh</a> active namespaces on ' + match, ''];
  function addText(str) {
    html.push(str.replace(/&/g, '&amp;').replace(/</g, '&lt;'));
  }
  var sorted = [];
  for (var j in this.nsps) {
    if (this.nsps.hasOwnProperty(j)) {
      var nsp = this.nsps[j];
      if (match != '*' && nsp.host != match) continue;
      sorted.push(j);
    }
  }
  sorted.sort(function(a, b) {
    // Sort slashes last.
    if (a == b) return 0;
    a = a.replace(/\//g, '\uffff');
    b = b.replace(/\//g, '\uffff');
    if (a < b) return -1;
    else return 1;
  });
  var now = +(new Date);
  for (j = 0; j < sorted.length; ++j) {
    var nsp = this.nsps[sorted[j]];
    addText(match == '*' ? nsp.fullname() : nsp.name);
    if (nsp.rooms && nsp.rooms.length > 1) {
      addText('  rooms: ' + nsp.rooms.join(' '));
    }
    if (nsp.sockets.length == 0) {
      var remaining = nsp._expiration() - now;
      var expinfo = '';
      if (remaining < Infinity) {
        expinfo = '; expires ' + remaining / 1000 + 's';
      }
      addText('  (no sockets' + expinfo + ')');
    } else for (var k = 0; k < nsp.sockets.length; ++k) {
      var socket = nsp.sockets[k];
      var clientdesc = '';
      if (socket.request.connection.remoteAddress) {
        clientdesc += ' from ' + socket.request.connection.remoteAddress;
      }
      var roomdesc = '';
      if (socket.rooms.length > 1) {
        for (var m = 0; m < socket.rooms.length; ++m) {
          if (socket.rooms[m] != socket.client.id) {
            roomdesc += ' ' + socket.rooms[m];
          }
        }
      }
      addText(' socket ' + socket.id + clientdesc + roomdesc);
    }
    html.push('');
  }
  if (!res) {
    return html.join('\n');
  }
  html.push('</pre>', '</body>', '</html>');
  res.setHeader('Content-Type', 'text/html');
  res.writeHead(200);
  res.end(html.join('\n'));
};

/**
 * Binds socket.io to an engine.io instance.
 *
 * @param {engine.Server} engine.io (or compatible) server
 * @return {Server} self
 * @api public
 */

Server.prototype.bind = function(engine){
  this.engine = engine;
  this.engine.on('connection', this.onconnection.bind(this));
  return this;
};

/**
 * Called with each incoming transport connection.
 *
 * @param {engine.Socket} socket
 * @return {Server} self
 * @api public
 */

Server.prototype.onconnection = function(conn){
  debug('incoming connection with id %s', conn.id);
  var host = this.getHost(conn);
  if (!host || matchPattern(this._mainHost, host)) {
    // The main host gets nulled out.
    host = null;
  }
  var client = new Client(this, conn, host);
  client.connect('/');
  return this;
};

/**
 * Extracts the host name from a connection.  May be overridden.
 *
 * @param {Connection} connection
 * @return {String} host name
 * @api public
 */

Server.prototype.getHost = function(conn){
  return conn.request.headers.host;
};

/**
 * For initialization, allow paterns to be regexps, '*', true, or a string.
 * Patterns containing special regexp characters are parsed as RegExps.
 *
 * @param {String|RegExp} given pattern
 * @return {String|RegExp} created pattern
 * @api private
 */
function makePattern(pattern) {
  if (pattern === true) return new RegExp('.^');  // matches nothing.
  if (pattern === '*') return new RegExp('.*');   // matches everything.
  if (/[*?+\[\](){}]/.test(pattern)) return new RegExp(pattern);
  if (pattern instanceof RegExp) return pattern;
  return pattern;
}

/**
 * Returns a match-like object, matching either a string or a RegExp.
 *
 * @param {String|RegExp} pattern is a string or RegExp
 * @param {String} str to match
 * @return {Object} regexp-match-like object
 * @api private
 */
function matchPattern(pattern, str) {
  if (pattern instanceof RegExp) {
    return pattern.exec(str);
  } else {
    return pattern == str ? {'0': str, index: 0, input: str} : null;
  }
}

/**
 * Set up intiialization for a namespace pattern.
 *
 * @param {String|RegExp} nsp name
 * @param {Function} nsp initiialization calback
 * @api public
 */

Server.prototype.setupNamespace = function(name, fn) {
  var pattern = makePattern(name);
  if (pattern instanceof RegExp) {
    this._setupPatterns.push({pattern: pattern, setup: fn});
  } else {
    this._setupNames[name] = fn;
  }
  for (var j in this.nsps) {
    if (this.nsps.hasOwnProperty(j)) {
      var nsp = this.nsps[j];
      if (!nsp.setupDone && null != (match = matchPattern(pattern, j))) {
        nsp.setupDone = -1;
        if (false === fn.apply(this, [nsp, match])) {
          nsp.setupDone = 0;
        } else {
          nsp.setupDone = 1;
        }
      }
    }
  }
};

/**
 * Looks up a namespace.
 *
 * @param {String} nsp name
 * @param {String} optional hostname
 * @param {Function} optional, nsp `connection` ev handler
 * @param {Boolean} auto (internal) true to request a dynamic namespace
 * @api public
 */

Server.prototype.of = function(name, host, fn, auto){
  if (fn == null && 'function' == typeof host) {
    fn = host;
    host = null;
  }
  if (String(name)[0] !== '/') name = '/' + name;
  var fullname = Namespace.qualify(name, host);
  var setup = null, match, j;
  if (!this.nsps[fullname]) {
    debug('initializing namespace %s', fullname);
    if (this._setupNames.hasOwnProperty(fullname)) {
      setup = this._setupNames[fullname];
    } else for (j = this._setupPatterns.length - 1; j >= 0; --j) {
      if (!!(match = matchPattern(this._setupPatterns[j].pattern, fullname))) {
        setup = this._setupPatterns[j].setup;
        break;
      }
    }
    if (auto && !setup) return null;
    var nsp = new Namespace(this, name, host);
    if (auto) nsp.retirement = this._defaultRetirement;
    this.nsps[fullname] = nsp;
    if (setup) {
      nsp.setupDone = -1;
      if (false === setup.apply(this, [nsp, match])) {
        debug('namespace %s rejected', fullname);
        delete this.nsps[fullname];
        return null;
      } else {
        nsp.setupDone = 1;
      }
    }
  }
  if (fn) this.nsps[fullname].on('connect', fn);
  return this.nsps[fullname];
};

/**
 * Closes server connection
 *
 * @api public
 */

Server.prototype.close = function(){
  this.nsps['/'].sockets.forEach(function(socket){
    socket.onclose();
  });

  this.engine.close();

  if(this.httpServer){
    this.httpServer.close();
  }
};

/**
 * Schedules a cleanup timer for deleting unused namespaces.
 *
 * @param {Number} millisecond delay
 * @api private
 */
Server.prototype.requestCleanupAfter = function(delay) {
  delay = Math.max(0, delay || 0);
  if (!(delay < Infinity)) return;
  var cleanupTime = delay + +(new Date);
  if (this._cleanupTimer && cleanupTime < this._cleanupTime) {
    clearTimeout(this._cleanupTimer);
    this._cleanupTimer = null;
  }
  // Do cleanup in 5-second batches.
  delay += Math.max(1, Math.min(delay, 5000));
  var server = this;
  if (!this._cleanupTimer) {
    this._cleanupTime = cleanupTime;
    this._cleanupTimer = setTimeout(doCleanup, delay);
  }
  function doCleanup() {
    server._cleanupTimer = null;
    server._cleanupTime = null;
    var earliestUnexpired = Infinity;
    var now = +(new Date);
    for (var j in server.nsps) {
      if (server.nsps.hasOwnProperty(j)) {
        var nsp = server.nsps[j];
        var expiration = nsp._expiration();
        if (expiration <= now) {
          nsp.expire(true);
          delete server.nsps[j];
        } else  {
          earliestUnexpired = Math.min(earliestUnexpired, expiration);
        }
      }
    }
    server.requestCleanupAfter(earliestUnexpired - now);
  }
};

/**
 * Expose main namespace (/).
 */

['on', 'to', 'in', 'use', 'emit', 'send', 'write'].forEach(function(fn){
  Server.prototype[fn] = function(){
    var nsp = this.sockets[fn];
    return nsp.apply(this.sockets, arguments);
  };
});

Namespace.flags.forEach(function(flag){
  Server.prototype.__defineGetter__(flag, function(name){
    this.flags.push(name);
    return this;
  });
});

/**
 * BC with `io.listen`
 */

Server.listen = Server;
