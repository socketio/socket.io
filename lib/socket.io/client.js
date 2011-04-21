
/*!
 * Socket.IO - Client
 * Copyright (c) 2010-2011 Guillermo Rauch <guillermo@learnboost.com>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var EventEmitter = require('events').EventEmitter
  , OutgoingMessage = require('http').OutgoingMessage
  , Stream = require('net').Stream
  , encode = require('./utils').encode
  , decode = require('./utils').decode
  , merge = require('./utils').merge
  , url = require('url');

/**
 * Expose `Client`.
 */

module.exports = Client;

/**
 * Initialize `Client`.
 *
 * @api private
 */

function Client(listener, req, res, options, head) {
  this.listener = listener;

  var defaults = {
      timeout: 8000
    , heartbeatInterval: 10000
    , closeTimeout: 0
  };

  options = merge(merge(defaults, this.options || {}), options);
  merge(this, options);

  this.connections = 0;
  this._open = false;
  this._heartbeats = 0;
  this.connected = false;
  this.upgradeHead = head;
  this._onConnect(req, res);
};

/**
 * Inherit from `EventEmitter.prototype`.
 */

Client.prototype.__proto__ = EventEmitter.prototype;

/**
 * Send the given `message` which is automatically
 * converted to JSON unless a string is given.
 *
 * @param {Object|String} message
 * @return {Client} for chaining
 * @api public
 */

Client.prototype.send = function(message){
  var state = this.connection.readyState;
  if (this._open && ('open' == state || 'writeOnly' == state)) {
    this._write(encode(message));
  } else {
    this._queue(message);
  }
  return this;
};

/**
 * Broadcast `message` to all the _other_ clients.
 *
 * @param {Object|String} message
 * @return {Client} for chaining
 * @api public
 */

Client.prototype.broadcast = function(message){
  if (!('sessionId' in this)) return this;
  this.listener.broadcast(message, this.sessionId);
  return this;
};

Client.prototype._onMessage = function(data){
  var messages = decode(data);
  if (messages === false) return this.listener.log('Bad message received from client ' + this.sessionId);
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
  var self = this
    , attachConnection = !this.connection;

  this.request = req;
  this.response = res;
  this.connection = req.connection;

  if(!attachConnection) attachConnection = !attachConnection && this.connection.eventsAttached === undefined;
  this.connection.eventsAttached = true;
  
  if (attachConnection){
    function destroyConnection(){
      self._onClose();
      self.connection && self.connection.destroy()
    };
    this.connection.addListener('end', destroyConnection);
    this.connection.addListener('timeout', destroyConnection);
    this.connection.addListener('error', destroyConnection);
    }
  
  if (req){
    function destroyRequest(){
      req.destroy && req.destroy();
    };
    req.addListener('error', destroyRequest);
    req.addListener('timeout', destroyRequest);
    if (res){
      function destroyResponse(){
        res.destroy && res.destroy();
      }
      res.addListener('error', destroyResponse);
      res.addListener('timeout', destroyResponse);
    }
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
  if (this.timeout) this._heartbeat();
};
  
Client.prototype._heartbeat = function(){
  var self = this;
  this._heartbeatInterval = setTimeout(function(){
    self.send('~h~' + ++self._heartbeats);
    self._heartbeatTimeout = setTimeout(function(){
      self._onClose();
    }, self.timeout);
  }, self.heartbeatInterval);
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
      }, this.closeTimeout);
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
  var origins = this.listener.origins;
  if (origins.indexOf('*:*') !== -1) {
    return true;
  }
  if (origin) {
    try {
      var parts = url.parse(origin);
      return origins.indexOf(parts.host + ':' + parts.port) !== -1 ||
          origins.indexOf(parts.host + ':*') !== -1 ||
          origins.indexOf('*:' + parts.port) !== -1;  
    } catch (ex) {}
  }
  return false;
};
