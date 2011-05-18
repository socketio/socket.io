/*!
 * socket.io-node
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var crypto = require('crypto')
  , Store = require('../store');

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
  this.clients = {};
}

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

Memory.prototype.handshake = function handshake (data, fn) {
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

Memory.prototype.isHandshaken = function isHandshaken (id, fn) {
  fn(null, ~this.handshaken.indexOf(id));
  return this;
};

/**
 * Generates a random id.
 *
 * @api private
 */

Memory.prototype.generateId = function generateId () {
  var rand = String(Math.random() * Math.random() * Date.now());
  return crypto.createHash('md5').update(rand).digest('hex');
};

/**
 * Retrieves a client store instance.
 *
 * @api public
 */

Memory.prototype.client = function client (id) {
  if (!this.clients[id]) {
    this.clients[id] = new Memory.Client(this, id);
    this.log.debug('initializing client store for', id);
  }

  return this.clients[id];
};

/**
 * Called when a client disconnects.
 *
 * @api public
 */

Memory.prototype.disconnect = function disconnect (id, force, reason) {
  if (~this.handshaken.indexOf(id)) {
    this.log.debug('destroying dispatcher for', id);

    this.handshaken.splice(this.handshaken.indexOf(id), 1);
    this.clients[id].destroy();
    this.clients[id] = null;

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

Memory.prototype.heartbeat = function heartbeat (id) {
  return this.publish('heartbeat-clear:' + id);
};

/**
 * Relays a packet
 *
 * @api private
 */

Memory.prototype.message = function message (id, packet) {
  return this.publish('message:' + id, packet);
};

/**
 * Simple publish
 *
 * @api public
 */

Memory.prototype.publish = function publish (ev, data) {
  this.emit(ev, data);
  return this;
};

/**
 * Simple subscribe
 *
 * @api public
 */

Memory.prototype.subscribe = function subscribe (chn, fn) {
  this.on(chn, fn);
  return this;
};

/**
 * Simple unsubscribe
 *
 * @api public
 */

Memory.prototype.unsubscribe = function unsubscribe (chn) {
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
}

/**
 * Inherits from Store.Client
 */

Client.prototype.__proto__ = Store.Client;

/**
 * Counts transport requests.
 *
 * @api public
 */

Client.prototype.count = function count (fn) {
  fn(null, ++this.reqs);
  return this;
};

/**
 * Sets up queue consumption
 *
 * @api public
 */

Client.prototype.consume = function consume (fn) {
  this.paused = false;

  if (this.buffer.length) {
    fn(this.buffer, null);
    this.buffer = [];
  } else {
    this.consumer = fn;
  }

  return this;
};

/**
 * Publishes a message to be sent to the client.
 *
 * @String encoded message
 * @api public
 */

Client.prototype.publish = function publish (msg) {
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

Client.prototype.pause = function pause () {
  this.paused = true;
  return this;
};

/**
 * Destroys the client.
 *
 * @api public
 */

Client.prototype.destroy = function destroy () {
  this.buffer = null;
};

/**
 * Gets a key
 *
 * @api public
 */

Client.prototype.get = function get (key, fn) {
  fn(null, this.dict[key]);
  return this;
};

/**
 * Sets a key
 *
 * @api public
 */

Client.prototype.set = function set (key, value, fn) {
  this.dict[key] = value;
  fn(null);
  return this;
};

/**
 * Emits a message incoming from client.
 *
 * @api private
 */

Client.prototype.onMessage = function onMessage (msg) {
  this.store.emit('message:' + id, msg);
};
