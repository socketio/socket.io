var urlparse = require('url').parse
  , OutgoingMessage = require('http').OutgoingMessage
  , Stream = require('net').Stream
  , Decoder = require('./data').Decoder
  , encode = require('./data').encode
  , encodeMessage = require('./data').encodeMessage
  , decodeMessage = require('./data').decodeMessage
  , options = require('./utils').options
  , merge = require('./utils').merge;

var Client = module.exports = function(listener, req, res, options, head){
  process.EventEmitter.call(this);
  this.listener = listener;
  this.options(merge({
    timeout: 8000,
    heartbeatInterval: 10000,
    closeTimeout: 0
  }, this.getOptions ? this.getOptions() : {}), options);
  this.connections = 0;
  this._open = false;
  this._heartbeats = 0;
  this.connected = false;
  this.upgradeHead = head;
  this.decoder = new Decoder();
  this.decoder.on('data', this._onMessage.bind(this));
  this._onConnect(req, res);
};

require('sys').inherits(Client, process.EventEmitter);

Client.prototype.send = function(message, anns){
  anns = anns || {};
  if (typeof message == 'object') anns['j'] = null;
  message = typeof message == 'object' ? JSON.stringify(message) : message;
  return this.write('1', encodeMessage(message, anns));
};

Client.prototype.sendJSON = function(message, anns){
  anns = anns || {};
  anns['j'] = null;
  return this.send(JSON.stringify(message), anns);
};

Client.prototype.write = function(type, data){
  if (!this._open) return this._queue(type, data);
  return this._write(encode([type, data]));
}

Client.prototype.broadcast = function(message, anns){
  if (!('sessionId' in this)) return this;
  this.listener.broadcast(message, this.sessionId, anns);
  return this;
};

Client.prototype._onData = function(data){
  this.decoder.add(data);
}

Client.prototype._onMessage = function(type, data){
  switch (type){
    case '0':
      this._onDisconnect();
      break;

    case '1':
      var msg = decodeMessage(data);
      // handle json decoding
      if ('j' in msg[1]) msg[0] = JSON.parse(msg[0]);
      this.emit('message', msg[0], msg[1]);
      break;

    case '2':
      this._onHeartbeat(data);
  }
};

Client.prototype._onConnect = function(req, res){
  var self = this;
  
  this.request = req;
  this.response = res;
  this.connection = req.connection;
  
  this.connection.addListener('end', function(){
    self._onClose();
  });
  
  if (req){
    req.addListener('error', function(err){
      req.end && req.end() || req.destroy && req.destroy();
    });
    if (res) res.addListener('error', function(err){
      res.end && res.end() || res.destroy && res.destroy();
    });
    req.connection.addListener('error', function(err){
      req.connection.end && req.connection.end() || req.connection.destroy && req.connection.destroy();
    });
    
    if (this._disconnectTimeout) clearTimeout(this._disconnectTimeout);
  }
};

Client.prototype._payload = function(){
  this._writeQueue = this._writeQueue || [];
  this.connections++;
  this.connected = true;
  this._open = true;
  
  if (!this.handshaked){
    this._generateSessionId();
    this._writeQueue.unshift(['3', this.sessionId]);
    this.handshaked = true;
  }
  
  // we dispatch the encoded current queue
  // in the future encoding will be handled by _write, that way we can
  // avoid framing for protocols with framing built-in (WebSocket)
  if (this._writeQueue.length){
    this._write(encode(this._writeQueue));
    this._writeQueue = [];
  }

  // if this is the first connection we emit the `connection` ev
  if (this.connections === 1)
    this.listener._onClientConnect(this);

  // send the timeout
  if (this.options.timeout)
    this._heartbeat();
};

Client.prototype._heartbeat = function(){
  var self = this;
  this._heartbeatInterval = setTimeout(function(){
    self.write('2', ++self._heartbeats);
    self._heartbeatTimeout = setTimeout(function(){
      self._onClose();
    }, self.options.timeout);
  }, this.options.heartbeatInterval);
};
  
Client.prototype._onHeartbeat = function(h){
  if (h == this._heartbeats){
    clearTimeout(this._heartbeatTimeout);
    this._heartbeat();
  }
};

Client.prototype._onClose = function(skipDisconnect){
  var self = this;
  if (this._heartbeatInterval) clearTimeout(this._heartbeatInterval);
  if (this._heartbeatTimeout) clearTimeout(this._heartbeatTimeout);
  this._open = false;
  if (this.connection){
    this.connection.end();
    this.connection.destroy();
    this.connection = null;
  }
  this.request = null;
  this.response = null;
  if (skipDisconnect !== false){
    if (this.handshaked){
      this._disconnectTimeout = setTimeout(function(){
        self._onDisconnect();
      }, this.options.closeTimeout);
    } else
      this._onDisconnect();
  }
};

Client.prototype._onDisconnect = function(){
  if (this._open) this._onClose(true);
  if (this._disconnectTimeout) clearTimeout(this._disconnectTimeout);
  this._writeQueue = [];
  this.connected = false;
  if (this.handshaked){
    this.emit('disconnect');
    this.listener._onClientDisconnect(this);
    this.handshaked = false;
  }
};

Client.prototype._queue = function(type, data){
  this._writeQueue = this._writeQueue || [];
  this._writeQueue.push([type, data]);
  return this;
};

Client.prototype._generateSessionId = function(){
  this.sessionId = ++this.listener._clientCount; // REFACTORME
  return this;
};

Client.prototype._verifyOrigin = function(origin){
  var origins = this.listener.options.origins;
  if (origins.indexOf('*:*') !== -1)
    return true;
  
  if (origin){
    try {
      var parts = urlparse(origin);
      return origins.indexOf(parts.host + ':' + parts.port) !== -1 ||
          origins.indexOf(parts.host + ':*') !== -1 ||
          origins.indexOf('*:' + parts.port) !== -1;  
    } catch (ex) {}
  }
  
  return false;
};

for (var i in options) Client.prototype[i] = options[i];
