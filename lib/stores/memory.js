
/*!
 * socket.io-node
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var crypto = require('crypto')
  , Store = require('../store')

/**
 * Exports the constructor.
 */

exports = module.exports = Memory;
Memory.Client = Client;

/**
 * Memory store
 *
 * @api public
 */

function Memory (opts) {
  this.handshaken = [];
  this.clientsMap = {};
  this.rooms = {};
};

/**
 * Inherits from Store.
 */

Memory.prototype.__proto__ = Store.prototype;

/**
 * Handshake a client.
 *
 * @param {Object} client request object
 * @param {Function} callback
 * @api public
 */

Memory.prototype.handshake = function (data, fn) {
  var id = this.generateId();
  this.handshaken.push(id);
  fn(null, id);
  return this;
};

/**
 * Checks if a client is handshaken.
 *
 * @api public
 */

Memory.prototype.isHandshaken = function (id, fn) {
  fn(null, ~this.handshaken.indexOf(id));
  return this;
};

/**
 * Generates a random id.
 *
 * @api private
 */

Memory.prototype.generateId = function () {
  var rand = String(Math.random() * Math.random() * Date.now());
  return crypto.createHash('md5').update(rand).digest('hex');
};

/**
 * Retrieves a client store instance.
 *
 * @api public
 */

Memory.prototype.client = function (id) {
  if (!this.clientsMap[id]) {
    this.clientsMap[id] = new Memory.Client(this, id);
    this.log.debug('initializing client store for', id);
  }

  return this.clientsMap[id];
};

/**
 * Called when a client disconnects.
 *
 * @api public
 */

Memory.prototype.disconnect = function (id, force, reason) {
  if (~this.handshaken.indexOf(id)) {
    this.log.debug('destroying dispatcher for', id);

    this.handshaken.splice(this.handshaken.indexOf(id), 1);
    this.clientsMap[id].destroy();
    this.clientsMap[id] = null;

    if (force)
      this.publish('disconnect-force:' + id, reason);

    this.publish('disconnect:' + id, reason);
  }

  return this;
};

/**
 * Relays a heartbeat message.
 *
 * @api private
 */

Memory.prototype.heartbeat = function (id) {
  return this.publish('heartbeat-clear:' + id);
};

/**
 * Relays a packet
 *
 * @api private
 */

Memory.prototype.message = function (id, packet) {
  return this.publish('message:' + id, packet);
};

/**
 * Returns client ids in a particular room
 *
 * @api public
 */

Memory.prototype.clients = function (room, fn) {
  if ('function' == typeof room) {
    fn = room;
    room = '';
  }

  fn && fn(this.rooms[room] || []);
};

/**
 * Joins a user to a room
 *
 * @api private
 */

Memory.prototype.join = function (sid, room, fn) {
  if (!this.rooms[room]) {
    this.rooms[room] = [];
  }

  this.client(sid).rooms[room] = this.rooms[room].length;
  this.rooms[room].push(sid);

  fn && fn();

  return this;
};

/**
 * Removes a user from a room
 *
 * @api private
 */

Memory.prototype.leave = function (sid, room, fn) {
  if (!this.rooms[room] || this.client(sid).rooms[room] === undefined) {
    return this;
  }

  var i = this.client(sid).rooms[room];
  this.rooms[room][i] = null;
  delete this.client(sid).rooms[room];

  fn && fn();

  return this;
};

/**
 * Simple publish
 *
 * @api public
 */

Memory.prototype.publish = function (ev, data, fn) {
  if ('function' == typeof data) {
    fn = data;
    data = undefined;
  }

  this.emit(ev, data);
  if (fn) fn();

  return this;
};

/**
 * Simple subscribe
 *
 * @api public
 */

Memory.prototype.subscribe = function (chn, fn) {
  this.on(chn, fn);
  return this;
};

/**
 * Simple unsubscribe
 *
 * @api public
 */

Memory.prototype.unsubscribe = function (chn) {
  this.removeAllListeners(chn);
};

/**
 * Client constructor
 *
 * @api private
 */

function Client () {
  Store.Client.apply(this, arguments);
  this.reqs = 0;
  this.paused = true;
  this.rooms = {};
};

/**
 * Inherits from Store.Client
 */

Client.prototype.__proto__ = Store.Client;

/**
 * Counts transport requests.
 *
 * @api public
 */

Client.prototype.count = function (fn) {
  fn(null, ++this.reqs);
  return this;
};

/**
 * Sets up queue consumption
 *
 * @api public
 */

Client.prototype.consume = function (fn) {
  this.consumer = fn;
  this.paused = false;

  if (this.buffer.length) {
    fn(this.buffer, null);
    this.buffer = [];
  }

  return this;
};

/**
 * Publishes a message to be sent to the client.
 *
 * @String encoded message
 * @api public
 */

Client.prototype.publish = function (msg) {
  if (this.paused) {
    this.buffer.push(msg);
  } else {
    this.consumer(null, msg);
  }

  return this;
};

/**
 * Pauses the stream.
 *
 * @api public
 */

Client.prototype.pause = function () {
  this.paused = true;
  return this;
};

/**
 * Destroys the client.
 *
 * @api public
 */

Client.prototype.destroy = function () {
  this.buffer = null;
};

/**
 * Gets a key
 *
 * @api public
 */

Client.prototype.get = function (key, fn) {
  fn(null, this.dict[key]);
  return this;
};

/**
 * Sets a key
 *
 * @api public
 */

Client.prototype.set = function (key, value, fn) {
  this.dict[key] = value;
  fn && fn(null);
  return this;
};

/**
 * Emits a message incoming from client.
 *
 * @api private
 */

Client.prototype.onMessage = function (msg) {
  this.store.emit('message:' + id, msg);
};

