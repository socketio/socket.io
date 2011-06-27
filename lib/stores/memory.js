
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
  Store.call(this, opts);
};

/**
 * Inherits from Store.
 */

Memory.prototype.__proto__ = Store.prototype;

/**
 * Publishes a message.
 *
 * @api private
 */

Memory.prototype.publish = function () { };

/**
 * Subscribes to a channel
 *
 * @api private
 */

Memory.prototype.subscribe = function () { };

/**
 * Unsubscribes
 *
 * @api private
 */

Memory.prototype.unsubscribe = function () { };

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

