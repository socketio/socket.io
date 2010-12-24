var url = require('url')
  , util = require(process.binding('natives').util ? 'util' : 'sys')
  , fs = require('fs')
  , options = require('./utils').options
  , Client = require('./client')
  , clientVersion = require('./../../support/socket.io-client/lib/io').io.version
  , transports = {};

var Listener = module.exports = function(server, options){
  process.EventEmitter.call(this);
  var self = this;
  this.server = server;
  this.options({
    origins: '*:*',
    resource: 'socket.io',
    flashPolicyServer: true,
    transports: ['websocket', 'flashsocket', 'htmlfile', 'xhr-multipart',
                 'xhr-polling', 'jsonp-polling'],
    transportOptions: {},
    log: util.log
  }, options);
  
  if (!this.options.log) this.options.log = function(){};

  this.clients = this.clientsIndex = {};
  this._clientCount = 0;
  this._clientFiles = {};
  
  var listeners = this.server.listeners('request');
  this.server.removeAllListeners('request');
  
  this.server.addListener('request', function(req, res){
    if (self.check(req, res)) return;
    for (var i = 0, len = listeners.length; i < len; i++){
      listeners[i].call(this, req, res);
    }
  });
  
  this.server.addListener('upgrade', function(req, socket, head){
    if (!self.check(req, socket, true, head)){
      socket.end();
      socket.destroy();
    }
  });
  
  this.options.transports.forEach(function(name) {
    if (!(name in transports))
      transports[name] = require('./transports/' + name);
    if ('init' in transports[name]) transports[name].init(self);
  });

  this.options.log('socket.io ready - accepting connections');
};

util.inherits(Listener, process.EventEmitter);
for (var i in options) Listener.prototype[i] = options[i];

Listener.prototype.broadcast = function(message, except){
  for (var i = 0, k = Object.keys(this.clients), l = k.length; i < l; i++){
    if (!except || ((typeof except == 'number' || typeof except == 'string') && k[i] != except)
                || (Array.isArray(except) && except.indexOf(k[i]) == -1)){
      this.clients[k[i]].send(message);
    }
  }
  return this;
};

Listener.prototype.check = function(req, res, httpUpgrade, head){
  var path = url.parse(req.url).pathname, parts, cn;
  if (path && path.indexOf('/' + this.options.resource) === 0){
    parts = path.substr(2 + this.options.resource.length).split('/');
    if (this._serveClient(parts.join('/'), req, res)) return true;
    if (!(parts[0] in transports)) return false;
    if (parts[1]){
      cn = this.clients[parts[1]];
      if (cn){
        cn._onConnect(req, res);
      } else {
        req.connection.end();
        req.connection.destroy();
        this.options.log('Couldnt find client with session id "' + parts[1] + '"');
      }
    } else {
      this._onConnection(parts[0], req, res, httpUpgrade, head);
    }
    return true;
  }
  return false;
};

Listener.prototype._serveClient = function(file, req, res){
  var self = this
    , clientPaths = {
        'socket.io.js': 'socket.io.js',
        'lib/vendor/web-socket-js/WebSocketMain.swf': 'lib/vendor/web-socket-js/WebSocketMain.swf', // for compat with old clients
        'WebSocketMain.swf': 'lib/vendor/web-socket-js/WebSocketMain.swf'
      }
    , types = {
        swf: 'application/x-shockwave-flash',
        js: 'text/javascript'
      };
  
  function write(path){
    if (req.headers['if-none-match'] == clientVersion){
      res.writeHead(304);
      res.end();
    } else {
      res.writeHead(200, self._clientFiles[path].headers);
      res.end(self._clientFiles[path].content, self._clientFiles[path].encoding);
    }
  };
  
  var path = clientPaths[file];
  
  if (req.method == 'GET' && path !== undefined){
    if (path in this._clientFiles){
      write(path);
      return true;
    }
    
    fs.readFile(__dirname + '/../../support/socket.io-client/' + path, function(err, data){
      if (err){
        res.writeHead(404);
        res.end('404');
      } else {
        var ext = path.split('.').pop();
        self._clientFiles[path] = {
          headers: {
            'Content-Length': data.length,
            'Content-Type': types[ext],
            'ETag': clientVersion
          },
          content: data,
          encoding: ext == 'swf' ? 'binary' : 'utf8'
        };
        write(path);
      }
    });
    
    return true;
  }
  
  return false;
};

Listener.prototype._onClientConnect = function(client){
  this.clients[client.sessionId] = client;
  this.options.log('Client '+ client.sessionId +' connected');
  this.emit('clientConnect', client);
  this.emit('connection', client);
};

Listener.prototype._onClientMessage = function(data, client){
  this.emit('clientMessage', data, client);
};

Listener.prototype._onClientDisconnect = function(client){
  delete this.clients[client.sessionId];
  this.options.log('Client '+ client.sessionId +' disconnected');
  this.emit('clientDisconnect', client);
};

Listener.prototype._onConnection = function(transport, req, res, httpUpgrade, head){
  this.options.log('Initializing client with transport "'+ transport +'"');
  new transports[transport](this, req, res, this.options.transportOptions[transport], head);
};
