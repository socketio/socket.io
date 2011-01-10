var urlparse = require('url').parse
  , OutgoingMessage = require('http').OutgoingMessage
  , Stream = require('net').Stream
  , options = require('./utils').options
  , encode = require('./utils').encode
  , decode = require('./utils').decode
  , merge = require('./utils').merge
  , util = require(process.binding('natives').util ? 'util' : 'sys');

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
  this._onConnect(req, res);
};

util.inherits(Client, process.EventEmitter);

Client.prototype.send = function(message){
  if (!this._open || !(this.connection.readyState === 'open' || this.connection.readyState === 'writeOnly')){
    return this._queue(message);
  }
  this._write(encode(message));
  return this;
};

Client.prototype.broadcast = function(message){
  if (!('sessionId' in this)) return this;
  this.listener.broadcast(message, this.sessionId);
  return this;
};

Client.prototype._onMessage = function(data){
  var messages = decode(data);
  if (messages === false) return this.listener.options.log('Bad message received from client ' + this.sessionId);
  for (var i = 0, l = messages.length, frame; i < l; i++){
    frame = messages[i].substr(0, 3);
    switch (frame){
      case '~h~':
        return this._onHeartbeat(messages[i].substr(3));
      case '~j~':
        try {
          messages[i] = JSON.parse(messages[i].substr(3));
        } catch(e) {
          messages[i] = {};
        }
        break;
    }
    this.emit('message', messages[i]);
    this.listener._onClientMessage(messages[i], this);
  }
};

Client.prototype._onConnect = function(req, res){
  var self = this;
  
  this.request = req;
  this.response = res;
  this.connection = req.connection;

  this.connection.addListener('end', function(){
    self._onClose();
    if (self.connection)
      self.connection.destroy();
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
  var payload = [];
  
  this.connections++;
  this.connected = true;
  this._open = true;
  
  if (!this.handshaked){
    this._generateSessionId();
    payload.push(this.sessionId);
    this.handshaked = true;
  }
  
  payload = payload.concat(this._writeQueue || []);
  this._writeQueue = [];

  if (payload.length) this._write(encode(payload));
  if (this.connections === 1) this.listener._onClientConnect(this);
  if (this.options.timeout) this._heartbeat();
};
  
Client.prototype._heartbeat = function(){
  var self = this;
  this._heartbeatInterval = setTimeout(function(){
    self.send('~h~' + ++self._heartbeats);
    self._heartbeatTimeout = setTimeout(function(){
      self._onClose();
    }, self.options.timeout);
  }, self.options.heartbeatInterval);
};
  
Client.prototype._onHeartbeat = function(h){
  if (h == this._heartbeats){
    clearTimeout(this._heartbeatTimeout);
    this._heartbeat();
  }
};

Client.prototype._onClose = function(skipDisconnect){
  if (!this._open) return this;
  var self = this;
  if (this._heartbeatInterval) clearTimeout(this._heartbeatInterval);
  if (this._heartbeatTimeout) clearTimeout(this._heartbeatTimeout);
  this._open = false;
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

Client.prototype._queue = function(message){
  this._writeQueue = this._writeQueue || [];
  this._writeQueue.push(message);
  return this;
};

Client.prototype._generateSessionId = function(){
  this.sessionId = Math.random().toString().substr(2);
  return this;
};

Client.prototype._verifyOrigin = function(origin){
  var origins = this.listener.options.origins;
  if (origins.indexOf('*:*') !== -1) {
    return true;
  }
  if (origin) {
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
